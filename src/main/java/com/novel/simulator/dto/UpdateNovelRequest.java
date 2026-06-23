package com.novel.simulator.dto;

public class UpdateNovelRequest {

    private String title;
    private String author;
    private String worldView;
    private Integer contentType;
    private String coverUrl;
    private Integer status;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getWorldView() { return worldView; }
    public void setWorldView(String worldView) { this.worldView = worldView; }
    public Integer getContentType() { return contentType; }
    public void setContentType(Integer contentType) { this.contentType = contentType; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
