package com.hackerton.menuscan;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/menu")
public class MenuScanController {

    @PostMapping("/scan")
    public String scan(@RequestBody MenuScanRequestDto request) {
        return request.getUrl();
    }
}

/*

 */
