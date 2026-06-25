package com.novel.simulator.service;

import com.novel.simulator.entity.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class EventChain {
    private static final Logger log = LoggerFactory.getLogger(EventChain.class);

    public Map<String, Object> generateEvent(UserSession session, Node currentNode,
                                              UserCharacter character, String eventType) {
        int sector = new Random().nextInt(6);
        Map<String, Object> result = new HashMap<>();
        String title, content;
        int hp=0, atk=0, def=0, inte=0, cha=0, luk=0;

        switch (sector) {
            case 0: // 奇遇
                title = "✨ 奇遇";
                content = "命运的齿轮悄然转动，你在一处不经意的地方发现了一段古老的铭文。"
                    + "虽然无法完全理解，但你的悟性似乎得到了启发。";
                inte = 1 + new Random().nextInt(3);
                luk = 1 + new Random().nextInt(3);
                break;
            case 1: // 宝箱
                title = "💎 宝箱";
                content = "你发现了一个被遗忘的宝箱！打开后，里面有一些珍贵的物资和装备。"
                    + "这让你在接下来的旅程中更有底气。";
                atk = 1 + new Random().nextInt(3);
                def = 1 + new Random().nextInt(3);
                luk = 1;
                break;
            case 2: // 战斗
                title = "⚔️ 战斗";
                content = "一阵腥风扑面而来，你遭到了袭击！经过一番激烈的搏斗，"
                    + "你虽然受了伤，但也从战斗中积累了宝贵的经验。";
                hp = -(10 + new Random().nextInt(10));
                atk = 1 + new Random().nextInt(2);
                def = 1;
                break;
            case 3: // 诅咒
                title = "💀 诅咒";
                content = "你触碰了不该碰的东西——一股阴冷的能量沿着手臂蔓延。"
                    + "你感到自己的气运在流逝，必须尽快找到化解之法。";
                hp = -(5 + new Random().nextInt(10));
                inte = -(1 + new Random().nextInt(3));
                luk = -(1 + new Random().nextInt(3));
                break;
            case 4: // 命运
                title = "🌀 命运";
                content = "一位神秘的占卜师出现在你面前，她凝视着你，目光仿佛穿透了时空。"
                    + "「你的命运……正在改变。」她留下这句话后便消失了。";
                luk = 2 + new Random().nextInt(4);
                inte = 1;
                break;
            default: // 邂逅
                title = "💕 邂逅";
                content = "你遇到了一位友善的旅人。你们相谈甚欢，临别时他/她送给你一些补给，"
                    + "并为你指了一条更安全的路。";
                cha = 1 + new Random().nextInt(3);
                hp = 5 + new Random().nextInt(10);
                break;
        }

        result.put("title", title);
        result.put("content", content);
        result.put("hpChange", hp);
        result.put("atkChange", atk);
        result.put("defChange", def);
        result.put("intChange", inte);
        result.put("chaChange", cha);
        result.put("lukChange", luk);
        return result;
    }
}
