package com.smartstock.inventory.controller;

import com.smartstock.inventory.dto.DashboardDtos.DashboardResponse;
import com.smartstock.inventory.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard/inventory")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public DashboardResponse dashboard(@RequestParam(defaultValue = "30") int days) {
        return dashboardService.dashboard(days);
    }
}
