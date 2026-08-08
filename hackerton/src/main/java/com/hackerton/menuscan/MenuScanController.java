package com.hackerton.menuscan;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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

/*

 */
