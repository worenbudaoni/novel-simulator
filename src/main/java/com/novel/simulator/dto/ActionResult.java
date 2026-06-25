package com.novel.simulator.dto;

import com.novel.simulator.entity.*;

public class ActionResult {
    private String actionType;
    private Node targetNode;
    private NodeOption chosenOption;
    private RandomEvent triggeredEvent;
    private UserCharacter character;
    private String eventDescription;

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public Node getTargetNode() { return targetNode; }
    public void setTargetNode(Node targetNode) { this.targetNode = targetNode; }
    public NodeOption getChosenOption() { return chosenOption; }
    public void setChosenOption(NodeOption chosenOption) { this.chosenOption = chosenOption; }
    public RandomEvent getTriggeredEvent() { return triggeredEvent; }
    public void setTriggeredEvent(RandomEvent triggeredEvent) { this.triggeredEvent = triggeredEvent; }
    public UserCharacter getCharacter() { return character; }
    public void setCharacter(UserCharacter character) { this.character = character; }
    public String getEventDescription() { return eventDescription; }
    public void setEventDescription(String eventDescription) { this.eventDescription = eventDescription; }
}
