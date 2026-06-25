package com.novel.simulator.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.common.Result;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public class AuthFilter extends OncePerRequestFilter {

    private static final String SESSION_PREFIX = "auth:sessions:";
    private static final long SESSION_TTL = 24;
    private static final List<String> WHITE_LIST = Arrays.asList("/api/auth/login", "/api/auth/register");

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public AuthFilter(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Player API 放行（游客可不带 token 访问，Controller 自行处理角色）
        if (path.startsWith("/api/player/")) {
            String token = request.getParameter("token");
            if (token != null && !token.isEmpty()) {
                // 有 token 则正常鉴权
                processAuth(request, response, filterChain, token);
            } else {
                // 无 token 也放行，Controller 按 GUEST 处理
                filterChain.doFilter(request, response);
            }
            return;
        }

        if (WHITE_LIST.contains(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 优先从 Authorization header 取，其次从 token query param 取（支持 SSE）
        String sessionId = null;
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            sessionId = authHeader.substring(7);
        } else {
            sessionId = request.getParameter("token");
        }

        if (sessionId == null || sessionId.isEmpty()) {
            writeUnauthorized(response, "Missing or invalid Authorization header");
            return;
        }
        processAuth(request, response, filterChain, sessionId);
    }

    private void processAuth(HttpServletRequest request, HttpServletResponse response,
                             FilterChain filterChain, String sessionId) throws IOException, ServletException {
        String sessionKey = SESSION_PREFIX + sessionId;
        String sessionJson = redisTemplate.opsForValue().get(sessionKey);

        if (sessionJson == null) {
            writeUnauthorized(response, "Session expired or invalid");
            return;
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> sessionData = objectMapper.readValue(sessionJson, Map.class);
            redisTemplate.expire(sessionKey, SESSION_TTL, TimeUnit.HOURS);

            @SuppressWarnings("unchecked")
            List<String> permissions = (List<String>) sessionData.get("permissions");
            List<SimpleGrantedAuthority> authorities = permissions != null
                ? permissions.stream().map(SimpleGrantedAuthority::new).collect(Collectors.toList())
                : Collections.emptyList();

            UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(sessionData, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authToken);
            request.setAttribute("currentUser", sessionData);

            filterChain.doFilter(request, response);
        } catch (Exception e) {
            writeUnauthorized(response, "Invalid session data");
        }
    }

    private void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(401);
        response.getWriter().write(objectMapper.writeValueAsString(Result.unauthorized(message)));
    }
}
