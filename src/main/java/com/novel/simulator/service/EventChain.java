package com.novel.simulator.service;

import com.novel.simulator.entity.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * LLM 随机事件生成 Chain
 * 根据世界观、当前节点、角色属性生成符合上下文的事件
 * 当前为 stub 实现，后续接入真实 LLM
 */
@Service
public class EventChain {
    private static final Logger log = LoggerFactory.getLogger(EventChain.class);

    private static final List<String> POSITIVE_EVENTS = Arrays.asList(
        "你发现了一个隐藏的宝箱，里面有一些有用的物品。",
        "一位路过的旅人给了你一些有用的建议。",
        "你找到了一条捷径，节省了不少时间。",
        "空气中弥漫着治愈的力量，你感到体力恢复了一些。"
    );

    private static final List<String> NEGATIVE_EVENTS = Arrays.asList(
        "你不慎踩中了陷阱，受到了伤害。",
        "一群强盗突然出现，抢走了你的一些物品。",
        "天气突然变得恶劣，你不得不在原地休息。",
        "你误入了有毒的雾区，感到身体不适。"
    );

    private static final List<String> NEUTRAL_EVENTS = Arrays.asList(
        "你听到了远处传来的奇怪声音，但什么都没有发生。",
        "一阵风吹过，卷起了地上的落叶。",
        "你发现了一些可疑的足迹，但它们很快就消失了。"
    );

    public Map<String, Object> generateEvent(UserSession session, Node currentNode,
                                              UserCharacter character, String eventType) {
        Map<String, Object> result = new HashMap<>();

        // 根据类型选择事件内容
        String content;
        int eventTypeCode;
        int hpChange = 0;

        if ("positive".equals(eventType) || Math.random() < 0.3) {
            eventTypeCode = 0;
            content = POSITIVE_EVENTS.get(new Random().nextInt(POSITIVE_EVENTS.size()));
            hpChange = new Random().nextInt(20) + 5;
        } else if (Math.random() < 0.6) {
            eventTypeCode = 1;
            content = NEGATIVE_EVENTS.get(new Random().nextInt(NEGATIVE_EVENTS.size()));
            hpChange = -(new Random().nextInt(25) + 5);
        } else {
            eventTypeCode = 2;
            content = NEUTRAL_EVENTS.get(new Random().nextInt(NEUTRAL_EVENTS.size()));
        }

        result.put("title", eventTypeCode == 0 ? "好运气" : eventTypeCode == 1 ? "倒霉事" : "怪事");
        result.put("content", content);
        result.put("eventType", eventTypeCode);
        result.put("hpChange", hpChange);

        return result;
    }
}
