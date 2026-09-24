package com.langnguyen.kltnweb;

import com.langnguyen.kltnweb.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.junit.platform.commons.util.StringUtils;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.StringTokenizer;

public class JwtTokenTest {

    @Test
    void test() {
        String username = "developer";
        JwtTokenProvider jwtTokenProvider = new JwtTokenProvider();
        String token = jwtTokenProvider.generateToken(username);

        StringTokenizer tokenizer = new StringTokenizer(token, ".");
        String header = tokenizer.nextToken();
        String payload = tokenizer.nextToken();
        String signature = tokenizer.nextToken();

        System.out.println(header);
        System.out.println(payload);
        System.out.println(signature);

        String header_decoded = new String(Decoders.BASE64URL.decode(header));
        String payload_decoded = new String(Decoders.BASE64URL.decode(payload));
        String signature_decoded = new String(Decoders.BASE64URL.decode(signature));

        System.out.println(header_decoded);
        System.out.println(payload_decoded);
        System.out.println(signature_decoded);

        assert payload_decoded.contains(username);
        assert username.equalsIgnoreCase(jwtTokenProvider.getClaimFromToken(token, Claims::getSubject));
        assert username.equalsIgnoreCase(jwtTokenProvider.getUsernameFromToken(token));
    }

}
