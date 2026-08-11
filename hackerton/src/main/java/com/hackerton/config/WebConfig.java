package com.hackerton.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // 모든 API 경로에 적용
                .allowedOriginPatterns("*") // origins("*") 대신 allowedOriginPatterns 사용 시 크레덴셜 관련 헤더 충돌 방지
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false) // 와일드카드(*) 사용 시 false여야 에러가 안 남
                .maxAge(3600);
    }
}
