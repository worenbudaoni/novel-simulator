package com.novel.simulator.dto;

import javax.validation.constraints.NotBlank;

public class CreateNovelRequest {

    @NotBlank(message = "作品名称不能为空")
    private String title;
    private String author;
    private Integer contentType;
    private String coverUrl;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public Integer getContentType() { return contentType; }
    public void setContentType(Integer contentType) { this.contentType = contentType; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }
}
