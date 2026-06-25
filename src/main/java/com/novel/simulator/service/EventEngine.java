package com.novel.simulator.service;

import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.mapper.RandomEventMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class EventEngine {

    private final RandomEventMapper randomEventMapper;

    public EventEngine(RandomEventMapper randomEventMapper) {
        this.randomEventMapper = randomEventMapper;
    }

    public RandomEvent drawEvent(Long novelId, Long nodeId) {
        List<RandomEvent> pool = new ArrayList<>();
        pool.addAll(randomEventMapper.selectList(
            new LambdaQueryWrapper<RandomEvent>()
                .eq(RandomEvent::getNovelId, novelId)
                .isNull(RandomEvent::getNodeId)));
        if (nodeId != null) {
            pool.addAll(randomEventMapper.selectList(
                new LambdaQueryWrapper<RandomEvent>()
                    .eq(RandomEvent::getNovelId, novelId)
                    .eq(RandomEvent::getNodeId, nodeId)));
        }
        if (pool.isEmpty()) return null;

        int totalWeight = pool.stream().mapToInt(e -> e.getWeight() != null ? e.getWeight() : 10).sum();
        int roll = new Random().nextInt(totalWeight);
        int cumulative = 0;
        for (RandomEvent event : pool) {
            cumulative += event.getWeight() != null ? event.getWeight() : 10;
            if (roll < cumulative) return event;
        }
        return pool.get(pool.size() - 1);
    }
}
