package com.hackerton.recommendation;


import org.springframework.web.bind.annotation.CrossOrigin;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@CrossOrigin(
        origins = "*",
        allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS}
)
@RestController
@RequestMapping("/api/recommendation")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;


    //최초 AI 메뉴 추천 API
    // POST /api/recommendation
    @PostMapping
    public ResponseEntity<RecommendationDto.Response> createRecommendation(@RequestBody RecommendationDto.Request request) {
        RecommendationDto.Response response = recommendationService.createRecommendation(request);
        return ResponseEntity.ok(response);
    }


     //조건 수정 및 시간 경과 반영 AI 메뉴 재추천 API
     // PUT /api/recommendation/{id}
    @PutMapping("/{id}")
    public ResponseEntity<RecommendationDto.Response> updateRecommendation(
            @PathVariable("id") Long id,
            @RequestBody RecommendationDto.ReRecommendRequest request) {
        RecommendationDto.Response response = recommendationService.updateRecommendation(id, request);
        return ResponseEntity.ok(response);
    }


    //추천 상세 결과 조회 API
    // GET /api/recommendation/{id}
    @GetMapping("/{id}")
    public ResponseEntity<RecommendationDto.Response> getRecommendation(@PathVariable("id") Long id) {
        RecommendationDto.Response response = recommendationService.getRecommendation(id);
        return ResponseEntity.ok(response);
    }


     //히스토리 전체 목록 조회 API
     // GET /api/recommendation
    @GetMapping
    public ResponseEntity<List<RecommendationDto.Response>> getAllRecommendations() {
        List<RecommendationDto.Response> response = recommendationService.getAllRecommendations();
        return ResponseEntity.ok(response);
    }
}
