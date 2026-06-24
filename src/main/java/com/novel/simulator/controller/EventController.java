package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.SaveEventsRequest;
import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.service.EventService;
import com.novel.simulator.service.NovelService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/novel")
public class EventController {

    private final EventService eventService;
    private final NovelService novelService;

    public EventController(EventService eventService, NovelService novelService) {
        this.eventService = eventService;
        this.novelService = novelService;
    }

    @GetMapping("/{id}/events")
    @PreAuthorize("hasAuthority('event:read')")
    public Result<List<RandomEvent>> getEvents(@PathVariable Long id) {
        novelService.getById(id);
        return Result.success(eventService.getEventsByNovelId(id));
    }

    @PutMapping("/{id}/events")
    @PreAuthorize("hasAuthority('event:update')")
    public Result<Void> saveEvents(@PathVariable Long id, @RequestBody SaveEventsRequest request) {
        novelService.getById(id);
        eventService.saveEvents(id, request.getEvents());
        return Result.success();
    }
}
