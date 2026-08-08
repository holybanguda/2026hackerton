package com.hackerton.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;



@Service
public class AiService {

    @Value("${openai.api.key}")
    private String apiKey;

    private final RestClient restClient;
    public AiService() {
        this.restClient = RestClient.create(/*TODO: 여기에 openai api 사이트*/);
    }

    public String extractMenus(String html) {

        /* TODO: ai 프롬프트 생성 및 전송 형태 정제, 응답 형태 정제
        String systemPrompt = """
            당신은 HTML에서 메뉴판 정보를 추출하는 파서입니다.
            HTML 내의 메뉴명(menuName), 가격(price, 숫자만), 카테고리(category)를 추출하여 JSON 배열 텍스트로만 응답하세요.
            마크다운 문법(```json 등)이나 부연 설명 없이 순수 JSON 배열만 출력하세요.
            """;

        Map<String, Object> requestBody = Map.of(
            "model", "TODO: 여기에 모델",
            "messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", html)
            ),
            "temperature", 0.1
        );

        Map response = restClient.post()
            .uri("/chat/completions")
            .header("Authorization", "Bearer " + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .body(requestBody)
            .retrieve()
            .body(Map.class);

        List choices = (List) response.get("choices");
        Map firstChoice = (Map) choices.get(0);
        Map message = (Map) firstChoice.get("message");
        String jsonResult = (String) message.get("content");

        return jsonResult.trim();
         */
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
    }
}
