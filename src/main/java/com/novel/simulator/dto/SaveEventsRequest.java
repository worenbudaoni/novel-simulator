package com.novel.simulator.dto;

import com.novel.simulator.entity.RandomEvent;
import java.util.List;

public class SaveEventsRequest {
    private List<RandomEvent> events;

    public List<RandomEvent> getEvents() { return events; }
    public void setEvents(List<RandomEvent> events) { this.events = events; }
}
