# OCI Quota 政策：升級 PAYG 前的成本護欄

> **現況（2026-08-25）：政策已刪除，目前帳號沒有任何 quota 政策。**
> 原因見下方「為什麼刪掉」——它擋住了 Always Free 的 A1，而在還沒升級 PAYG 之前，
> 它提供的保護是零（Free Tier 帳號本來就開不出付費規格）。
>
> 這份文件保留下來，是因為**真的要升級 PAYG 之前需要一份正確的版本**，
> 而這次踩到的三個坑值得記著。

---

## 這次實際驗證出來的三件事

### 1. `zero <family> quotas` 的優先權蓋過所有例外語句

文件與直覺都會告訴你可以這樣寫：

```
zero compute-core quotas in tenancy
unset compute-core quota standard-a1-core-count in tenancy    # 開一個例外
```

**這個寫法不成立。** 實測順序：

| 嘗試 | 結果 |
|---|---|
| `zero` + `unset <例外>` | ❌ 仍被擋 |
| `zero` + `set <例外> to 4` | ❌ 仍被擋 |
| 調整語句順序 | ❌ 沒有差別 |

錯誤訊息長這樣：

```
"code": "QuotaExceeded",
"message": "The following compartment quotas were exceeded:
            standard-a1-core-regional-count in policy 'ocid1.quota...' by 1"
```

**結論：不要用「全部歸零再開例外」的寫法。** 要嘛逐一 `set` 你想擋的付費規格為 0，
要嘛不要用 blanket `zero`。

### 2. 同一個資源有「AD 版」和「Regional 版」兩套配額

這是最容易漏的一點。A1 的核心數有兩個 quota：

```
standard-a1-core-count            ← AD 層級
standard-a1-core-regional-count   ← 區域層級（就是這個擋住我的）
```

只處理其中一個沒有用。`memory` 也有同樣的成對關係
（但 `standard-a1-memory-count` 不屬於 `compute-core` 家族，送出去會被 API 拒絕，
 這代表 `zero compute-core quotas` 本來就碰不到記憶體）。

### 3. `oci limits value list` **不反映** quota 政策

這是當初讓我誤判「政策設定成功」的原因。套用政策之後我查：

```bash
oci limits value list --service-name compute -c <tenancy> \
  --query 'data[?contains(name,`standard-a1`)]'
# → standard-a1-core-count 2、standard-a1-core-regional-count 2
```

看起來 A1 完好無損，實際上**送出建立請求就會被 quota 擋掉**。

`limits value list` 顯示的是 **service limit**（你的帳號方案給你多少），
quota 政策是疊在上面的另一層，這個指令看不到。

> **唯一可靠的驗證方法是真的送一次 API 請求**，看回來的是
> `Out of host capacity`（管道通、只是沒容量）還是 `QuotaExceeded`（被自己的政策擋住）。

---

## 家族名稱與語法（這部分是對的）

- quota 家族名是 **`compute-core`**，不是 `oci limits service list` 顯示的 `compute`。
  服務名（limits API）與 quota 家族名（政策語言）是兩套命名。
- `block-storage`、`load-balancer` 的家族名與服務名相同。
- `unset` 的語意是「移除這條 quota，回到 service limit」，不是「設成無限」。

## 已驗證有效的語句

```
# Block Volume 卡在 Always Free 的 200GB —— 實測套用後查詢確實變成 200
set block-storage quota total-storage-gb to 200 in tenancy
set block-storage quota backup-count to 5 in tenancy
```

## 已驗證無效的語句

```
zero <family> quotas in tenancy
unset <family> quota <某個例外> in tenancy      # 例外不會生效
set   <family> quota <某個例外> to N in tenancy  # 例外一樣不會生效
```

---

## 下次要升級 PAYG 時，建議這樣做

**先確認自己要擋什麼**，而不是先歸零再開洞：

1. **用逐一 `set ... to 0` 擋掉你確定不要的付費規格**
   缺點是 OCI 會新增 shape，清單要定期維護；優點是不會誤傷 Always Free。

2. **Block Volume 用 `set total-storage-gb to 200`**
   這個實測有效，而且是最實際的成本閘門（Boot Volume 也算在裡面）。

3. **套用之後，一定要用真實 API 請求驗證**
   例如故意送一次 A1 的 `launch-instance`，確認回來的是 `Out of host capacity`
   而不是 `QuotaExceeded`。**不要只看 `limits value list`。**

4. **Budget 告警是獨立的第二道保險**
   Console → Billing & Cost Management → Budgets，金額設 US$1、門檻 50%。
   Budget **只會寄信不會停用資源**，但正常情況下帳單應該永遠是 $0，
   所以那封信寄出來就代表有事情不對勁。

---

## 為什麼刪掉

2026-08-25 掛上 A1 重試腳本，第一次送出建立請求就拿到 `QuotaExceeded`——
被自己一週前設的護欄擋住。試了 `unset`、`set`、換順序都無效之後，直接刪除整個政策。

判斷依據很簡單：**帳號當時還是 Always Free，本來就開不出付費規格**，
這道護欄一分保護都沒提供，卻擋住了唯一想要的東西。
護欄的價值只存在於「升級 PAYG 之後」，那時再依照上面的建議重寫一版。

刪除後 quota 有幾分鐘的傳播延遲（錯誤訊息仍引用已刪除的 policy ID），
等生效之後重試腳本立刻拿到 `Out of host capacity`，代表管道打通。
