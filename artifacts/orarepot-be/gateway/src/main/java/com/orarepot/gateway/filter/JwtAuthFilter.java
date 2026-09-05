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
      "/v1/",
      "/actuator",
      "/health"
  );

  private final SecretKey key;

  public JwtAuthFilter(@Value("${orarepot.jwt-secret}") String secret) {
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
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
      ServerHttpRequest mutated = request.mutate()
          .header("X-User-Id", claims.getSubject())
          .header("X-User-Email", stringClaim(claims, "email"))
          .build();
      return chain.filter(exchange.mutate().request(mutated).build());
    } catch (Exception ex) {
      exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
      return exchange.getResponse().setComplete();
    }
  }

  private static boolean isPublic(String path) {
    for (String prefix : PUBLIC_PREFIXES) {
      if (path.equals(prefix) || path.startsWith(prefix) || path.startsWith(prefix + "/")) {
        return true;
      }
    }
    return path.equals("/auth/register") || path.equals("/auth/login");
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
