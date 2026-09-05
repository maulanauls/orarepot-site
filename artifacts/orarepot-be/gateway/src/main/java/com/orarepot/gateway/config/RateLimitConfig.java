package com.orarepot.gateway.config;

import java.net.InetSocketAddress;
import java.util.Objects;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import reactor.core.publisher.Mono;

@Configuration
public class RateLimitConfig {

  @Bean
  KeyResolver userOrIpKeyResolver() {
    return exchange -> {
      String user = exchange.getRequest().getHeaders().getFirst("X-User-Id");
      if (user != null && !user.isBlank()) {
        return Mono.just(user);
      }
      String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
      if (auth != null && !auth.isBlank()) {
        return Mono.just(auth);
      }
      InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
      return Mono.just(remote == null ? "anonymous" : Objects.toString(remote.getAddress().getHostAddress(), "anonymous"));
    };
  }
}
