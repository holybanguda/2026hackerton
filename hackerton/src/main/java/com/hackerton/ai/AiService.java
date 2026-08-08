package com.hackerton.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;



@Service
public class AiService {

    @Value("${openai.api.key}")
    private String apiKey;

    private final RestClient restClient;

    public AiService() {
        this.restClient = RestClient.builder()
                .baseUrl("https://api.openai.com/v1") //TODO: 임시 openai api 주소
                .build();
    }

    public String extractMenus(String html) {
        String systemPrompt = """
            당신은 HTML에서 메뉴판 정보를 추출하는 파서입니다.
            HTML 내의 메뉴명(menuName), 가격(price, 숫자만), 카테고리(category)를 추출하여 JSON 배열 텍스트로만 응답하세요.
            마크다운 문법(```json 등)이나 부연 설명 없이 순수 JSON 배열만 출력하세요.
            """;

        AiRequestDto requestBody = AiRequestDto.createExtractPrompt("gpt-4o-mini", systemPrompt, html);
        //TODO:임시 openai 모델

        AiResponseDto response = restClient.post()
                .uri("/chat/completions") //TODO:baseurl 뒤에 붙을 세부 주소
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(AiResponseDto.class);

        return response != null ? response.getFirstContent() : "";

        /* 임시 테스트 데이터
        return """
            [
              {
                "menuName":"김치찌개",
                "price":9000,
                "category":"찌개"
              },
              {
                "menuName":"계란말이",
                "price":7000,
                "category":"사이드"
              }
            ]
            """;
            */
    }
}
