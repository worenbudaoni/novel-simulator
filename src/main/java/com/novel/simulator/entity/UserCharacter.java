package com.novel.simulator.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("user_character")
public class UserCharacter {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String sessionId;
    private Integer hp;
    private Integer attack;
    private Integer defense;
    private Integer intelligence;
    private Integer charm;
    private Integer luck;
    private String currentTitle;
    private String titlesJson;
    private Integer choicesMade;
    private Integer eventsTriggered;
    private Integer timesDied;
    private Integer finalScore;
    private String finalRank;
    private String rankReason;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Integer getHp() { return hp; }
    public void setHp(Integer hp) { this.hp = hp; }
    public Integer getAttack() { return attack; }
    public void setAttack(Integer attack) { this.attack = attack; }
    public Integer getDefense() { return defense; }
    public void setDefense(Integer defense) { this.defense = defense; }
    public Integer getIntelligence() { return intelligence; }
    public void setIntelligence(Integer intelligence) { this.intelligence = intelligence; }
    public Integer getCharm() { return charm; }
    public void setCharm(Integer charm) { this.charm = charm; }
    public Integer getLuck() { return luck; }
    public void setLuck(Integer luck) { this.luck = luck; }
    public String getCurrentTitle() { return currentTitle; }
    public void setCurrentTitle(String currentTitle) { this.currentTitle = currentTitle; }
    public String getTitlesJson() { return titlesJson; }
    public void setTitlesJson(String titlesJson) { this.titlesJson = titlesJson; }
    public Integer getChoicesMade() { return choicesMade; }
    public void setChoicesMade(Integer choicesMade) { this.choicesMade = choicesMade; }
    public Integer getEventsTriggered() { return eventsTriggered; }
    public void setEventsTriggered(Integer eventsTriggered) { this.eventsTriggered = eventsTriggered; }
    public Integer getTimesDied() { return timesDied; }
    public void setTimesDied(Integer timesDied) { this.timesDied = timesDied; }
    public Integer getFinalScore() { return finalScore; }
    public void setFinalScore(Integer finalScore) { this.finalScore = finalScore; }
    public String getFinalRank() { return finalRank; }
    public void setFinalRank(String finalRank) { this.finalRank = finalRank; }
    public String getRankReason() { return rankReason; }
    public void setRankReason(String rankReason) { this.rankReason = rankReason; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
