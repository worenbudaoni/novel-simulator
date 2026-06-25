package com.novel.simulator.service;

import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 离线节点生成器 — 在 LLM 不可用时生成标准的多分支多结局图
 * 12 个节点 + 4 个结局，每节点 3-4 个选项，网状结构
 */
@Service
public class DemoNodeGenerator {

    public Map<String, Object> generate(int nodeCount, int eventCount, String title) {
        // 确保节点数 >= 10
        int n = Math.max(nodeCount, 12);
        if (n > 30) n = 30;

        String wt = "这是一个充满未知与冒险的世界。「" + (title.isEmpty() ? "未知旅程" : title) + "」的故事就此展开。"
            + "你扮演一位初出茅庐的冒险者，在这个世界中探索、战斗、抉择，最终走向不同的命运。\n\n"
            + "世界背景：一个架空的奇幻大陆，各地散布着远古遗迹，隐藏着不为人知的秘密。";

        // 生成节点
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        List<Map<String, Object>> options = new ArrayList<>();

        // 按顺序生成节点
        String[] defaultTitles = {
            "起点小镇", "迷雾森林", "古老遗迹", "岔路驿站", "幽暗洞穴",
            "山巅之城", "地下迷宫", "秘密花园", "龙栖之地", "命运之门",
        };
        String[] defaultDescs = {
            "你从小镇的旅馆中醒来，窗外阳光明媚。小镇居民们各自忙碌着，似乎一切都很平静。",
            "森林中浓雾弥漫，看不清前方的路。偶尔传来奇怪的声响，让人不寒而栗。",
            "你发现了一座古老的遗迹，石门上刻满了看不懂的符文。空气中弥漫着神秘的力量。",
            "这是一个三岔路口，竖着三块路牌分别指向不同的方向。路边有一位老者正在歇脚。",
            "洞穴深处传来滴水声。墙壁上闪烁着微弱的荧光，照亮了前方的路。",
            "一座建在山巅之上的城市，云雾缭绕如同仙境。城中居民似乎过着与世隔绝的生活。",
            "错综复杂的地下通道如同迷宫一般。你不得不仔细记住来时的路。",
            "在隐秘的山谷中，你发现了一座开满奇异花朵的花园，空气中弥漫着沁人的香气。",
            "传说中龙的栖息地。你感受到一股强大的气息，大地在微微震颤。",
            "一扇巨大的石门矗立在面前，门上刻着「命运」二字。这是最后的抉择之地。",
        };

        // 生成足够的节点（补充额外的）
        List<String> titles = new ArrayList<>(Arrays.asList(defaultTitles));
        List<String> descs = new ArrayList<>(Arrays.asList(defaultDescs));
        while (titles.size() < n) {
            int idx = titles.size() + 1;
            titles.add("场景" + idx);
            descs.add("你来到了一个新的地方。周围的环境让你感到既陌生又熟悉。");
        }

        Random rand = new Random();

        // 创建节点 map
        for (int i = 0; i < n; i++) {
            Map<String, Object> node = new HashMap<>();
            node.put("title", titles.get(i));
            node.put("description", descs.get(i));
            node.put("isStart", i == 0);
            node.put("isEnd", i >= n - 4); // 最后 4 个为结局
            node.put("sortOrder", i);
            node.put("nodeType", 0);
            node.put("minIntelligence", (i == n - 1) ? 60 : 0); // 隐藏结局需智力≥60
            node.put("minCharm", 0);
            nodes.add(node);
        }

        // 前 n-4 个节点是普通节点，后 4 个是结局节点
        int storyNodes = n - 4;
        int endNodes = 4;

        // 生成边和选项
        for (int i = 0; i < storyNodes; i++) {
            // 每个节点有 2-4 个选项
            int optCount = 2 + rand.nextInt(3); // 2-4

            // 非哨兵模式下，不同节点指向不同后续
            List<Integer> targets = new ArrayList<>();

            if (i == 0) {
                // 起始节点：指向 1, 2, 3
                targets = Arrays.asList(1, 2, 3);
            } else if (i < storyNodes - 1) {
                // 中间节点：指向后面 2-4 个不同节点，确保网状
                int maxNext = Math.min(storyNodes, i + 1 + rand.nextInt(3) + 1);
                for (int t = i + 1; t <= maxNext && targets.size() < optCount; t++) {
                    targets.add(t);
                }
                // 偶尔指向非连续的节点（跳转）
                if (rand.nextBoolean() && i + 3 < storyNodes) {
                    targets.add(i + 3 + rand.nextInt(Math.max(1, storyNodes - i - 3)));
                }
                // 偶尔指向结局
                if (rand.nextBoolean() && i > storyNodes / 2) {
                    targets.add(storyNodes + rand.nextInt(endNodes));
                }
                // 去重
                Set<Integer> dedup = new LinkedHashSet<>(targets);
                targets = new ArrayList<>(dedup);
                // 限制数量
                while (targets.size() > optCount) targets.remove(targets.size() - 1);
                // 保证至少 1 个
                if (targets.isEmpty()) targets.add(i + 1);
            } else {
                // 最后一个故事节点：指向所有结局
                for (int e = 0; e < endNodes; e++) targets.add(storyNodes + e);
            }

            // 生成每个选项
            String[] prefixes = {"前往", "探索", "调查", "进入", "走向", "追寻", "踏上", "冒险"};
            for (int j = 0; j < targets.size() && j < 4; j++) {
                int targetIdx = targets.get(j);
                Map<String, Object> opt = new HashMap<>();
                opt.put("nodeIndex", i);
                opt.put("label", prefixes[rand.nextInt(prefixes.length)] + "·" + titles.get(Math.min(targetIdx, n - 1)));
                opt.put("targetNodeIndex", targetIdx);
                opt.put("triggerEvent", false);

                // 部分选项有风险提示（仅标记，前端不显示）
                if (rand.nextDouble() < 0.2) {
                    opt.put("riskHint", "危险");
                }

                // 某些选项有属性要求
                if (j == 2 && i > 2) {
                    opt.put("minIntelligence", 60); // 隐藏路线
                }

                options.add(opt);

                // 生成边
                Map<String, Object> edge = new HashMap<>();
                edge.put("sourceNodeIndex", i);
                edge.put("targetNodeIndex", targetIdx);
                edge.put("conditionDesc", "");
                edge.put("edgeType", 0);
                edges.add(edge);
            }
        }

        // 补充不足的边（确保节点间连接足够）
        for (int i = 0; i < storyNodes - 1; i++) {
            boolean hasEdge = false;
            for (Map<String, Object> e : edges) {
                if ((int) e.get("sourceNodeIndex") == i) { hasEdge = true; break; }
            }
            if (!hasEdge) {
                Map<String, Object> edge = new HashMap<>();
                edge.put("sourceNodeIndex", i);
                edge.put("targetNodeIndex", i + 1);
                edge.put("conditionDesc", "");
                edge.put("edgeType", 0);
                edges.add(edge);
            }
        }

        Map<String, Object> attrTemplate = new HashMap<>();
        attrTemplate.put("hp", 100);
        attrTemplate.put("attack", 10);
        attrTemplate.put("defense", 10);
        attrTemplate.put("intelligence", 50);
        attrTemplate.put("charm", 50);
        attrTemplate.put("luck", 50);

        Map<String, Object> result = new HashMap<>();
        result.put("exists", true);
        result.put("worldView", wt);
        result.put("nodes", nodes);
        result.put("edges", edges);
        result.put("options", options);
        result.put("attrTemplate", attrTemplate);
        result.put("summary", "一个充满未知与冒险的世界，你的命运由你自己书写。");
        result.put("author", "AI 生成");

        return result;
    }
}
