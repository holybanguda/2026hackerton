package com.hackerton.menuscan;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin("*")
@RequiredArgsConstructor
@RestController
@RequestMapping("/menu")
public class MenuScanController {

    private final MenuScanService menuScanService;

    @PostMapping("/scan")
    public ResponseEntity<List<MenuEntity>> scan(@RequestBody MenuScanRequestDto request) {
        List<MenuEntity> menus = menuScanService.scanMenu(request.getUrl());

        return ResponseEntity.ok(menus);
    }

}
