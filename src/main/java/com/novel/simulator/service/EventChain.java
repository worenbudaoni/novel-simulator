package com.novel.simulator.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EventChain {
    private static final Logger log = LoggerFactory.getLogger(EventChain.class);

    public String generateEventDescription(Long novelId, String eventTitle, String eventContent) {
        if (eventContent != null && !eventContent.isEmpty()) return eventContent;
        return "发生了随机事件：「" + eventTitle + "」。你感受到一股未知的力量影响了你的状态。";
    }
}
