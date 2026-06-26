package com.novel.simulator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class NovelSimulatorApplication {

    public static void main(String[] args) {
        SpringApplication.run(NovelSimulatorApplication.class, args);
    }

}
