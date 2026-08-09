package com.hackerton.recommendation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class RecommendationDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MenuItemDto {
        private String menuName;
        private Integer price;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Request {
        private String restaurantUrl;
        private List<MenuItemDto> menuList;
        private Integer peopleCount;
        private Integer budget;
        private String meetingType;
        private List<String> excludedFoods;
        private Integer bigEaterCount;
        private Integer spicyLevel;
        private Integer dietCount;
        private String todayPreference;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReRecommendRequest {
        private String restaurantUrl;
        private List<MenuItemDto> menuList;
        private Integer peopleCount;
        private Integer budget;
        private String meetingType;
        private List<String> excludedFoods;
        private Integer bigEaterCount;
        private Integer spicyLevel;
        private Integer dietCount;
        private String todayPreference;
        private Integer elapsedMinutes;
        private Integer budgetDelta;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private Long recommendationId;
        private String restaurantUrl;
        private List<String> recommendedMenus;
        private Integer totalPrice;
        private String reason;
        private String engineType;
    }
}
