package com.k8sdemo.userservice.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "menus")
public class Menu {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String name;    // 顯示名稱 (如: 批次概覽)

    @Column(nullable = false)
    private String code;    // 唯一代碼 (如: lot-overview)

    @Column
    private String path;    // 路由路徑 (如: /lot-overview)

    @Column
    private String icon;    // 圖標代碼
    @Column(name = "sort_order")
    private Integer sortOrder;

    // Getters & Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
