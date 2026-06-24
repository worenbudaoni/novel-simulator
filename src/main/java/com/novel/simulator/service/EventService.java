package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.mapper.RandomEventMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class EventService {

    private final RandomEventMapper randomEventMapper;

    public EventService(RandomEventMapper randomEventMapper) {
        this.randomEventMapper = randomEventMapper;
    }

    public List<RandomEvent> getEventsByNovelId(Long novelId) {
        return randomEventMapper.selectList(
            new LambdaQueryWrapper<RandomEvent>().eq(RandomEvent::getNovelId, novelId)
                .orderByAsc(RandomEvent::getCreatedAt));
    }

    @Transactional
    public void saveEvents(Long novelId, List<RandomEvent> events) {
        randomEventMapper.delete(
            new LambdaQueryWrapper<RandomEvent>().eq(RandomEvent::getNovelId, novelId));

        if (events != null) {
            for (RandomEvent event : events) {
                event.setNovelId(novelId);
                event.setCreatedAt(LocalDateTime.now());
                randomEventMapper.insert(event);
            }
        }
    }
}
