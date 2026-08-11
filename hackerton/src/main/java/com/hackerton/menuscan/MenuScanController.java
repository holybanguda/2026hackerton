package com.hackerton.menuscan;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(
        origins = "*",
        allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS}
)
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
