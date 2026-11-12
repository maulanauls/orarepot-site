package com.orarepot.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

  private static final List<String> PUBLIC_PREFIXES = List.of(
      "/auth/register",
      "/auth/login",
      "/auth/google",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/biller/auth/register",
      "/biller/auth/enter",
      "/biller/auth/login",
      "/biller/catalog",
      "/billing/payments/midtrans",
      "/v1/",
      "/actuator",
      "/health"
  );

  private final SecretKey key;
  private final ReactiveStringRedisTemplate redis;

  public JwtAuthFilter(
      @Value("${orarepot.jwt-secret}") String secret,
      ReactiveStringRedisTemplate redis) {
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.redis = redis;
  }

  @Override
  public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    ServerHttpRequest request = exchange.getRequest();
    if (request.getMethod() == HttpMethod.OPTIONS) {
      return chain.filter(exchange);
    }
    String path = request.getURI().getPath();
    if (isPublic(path)) {
      return chain.filter(exchange);
    }
    String header = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
    if (header == null || !header.startsWith("Bearer ")) {
      exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
      return exchange.getResponse().setComplete();
    }
    try {
      Claims claims = Jwts.parser()
          .verifyWith(key)
          .build()
          .parseSignedClaims(header.substring(7))
          .getPayload();
      if ("biller".equals(stringClaim(claims, "kind"))) {
        String jti = claims.getId() == null ? "" : claims.getId();
        if (jti.isEmpty()) {
          return unauthorized(exchange);
        }
        return redis.hasKey("biller:session:" + jti)
            .onErrorResume(ex -> Mono.just(false))
            .flatMap(active -> Boolean.TRUE.equals(active)
                ? forward(exchange, chain, claims)
                : unauthorized(exchange));
      }
      return forward(exchange, chain, claims);
    } catch (Exception ex) {
      return unauthorized(exchange);
    }
  }

  private static Mono<Void> forward(ServerWebExchange exchange, GatewayFilterChain chain, Claims claims) {
    ServerHttpRequest mutated = exchange.getRequest().mutate()
        .header("X-User-Id", claims.getSubject())
        .header("X-User-Email", stringClaim(claims, "email"))
        .build();
    return chain.filter(exchange.mutate().request(mutated).build());
  }

  private static Mono<Void> unauthorized(ServerWebExchange exchange) {
    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
    return exchange.getResponse().setComplete();
  }

  private static boolean isPublic(String path) {
    for (String prefix : PUBLIC_PREFIXES) {
      if (path.equals(prefix) || path.startsWith(prefix) || path.startsWith(prefix + "/")) {
        return true;
      }
    }
    // Invitee can decline with invite token only (no JWT).
    if (path.startsWith("/members/invites/") && path.endsWith("/decline")) {
      return true;
    }
    return path.equals("/auth/register")
        || path.equals("/auth/login")
        || path.equals("/auth/forgot-password")
        || path.equals("/auth/reset-password");
  }

  private static String stringClaim(Claims claims, String name) {
    Object value = claims.get(name);
    return value == null ? "" : value.toString();
  }

  @Override
  public int getOrder() {
    return -1;
  }
}
