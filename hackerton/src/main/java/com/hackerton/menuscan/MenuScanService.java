package com.hackerton.menuscan;

import com.hackerton.ai.AiService;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@RequiredArgsConstructor
@Service
public class MenuScanService {

    private final MenuRepository menuRepository;
    private final AiService aiService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<MenuEntity> scanMenu(String url) {
        List<MenuEntity> savedMenus = menuRepository.findByRestaurantUrl(url);

        if (!savedMenus.isEmpty()) { return savedMenus; }

        try {
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept-Language", "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7")
                    .referrer("https://m.place.naver.com/")
                    .timeout(5000)
                    .get();
            String html = doc.html();

            String aiResponseJson = aiService.extractMenus(html);

            List<MenuEntity> newMenus = objectMapper.readValue(aiResponseJson, new TypeReference<List<MenuEntity>>() {});

            for (MenuEntity menu : newMenus) {
                menu.setRestaurantUrl(url);
                menu.setCachedAt(LocalDateTime.now());
            }

            menuRepository.saveAll(newMenus);

            return newMenus;

        } catch (IOException e) {
            e.printStackTrace();
            return Collections.emptyList();
        }
    }
}


/*
++ qr '메뉴판 식당'이라고 찾기
 */