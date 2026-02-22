float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    vec3 col = vec3(0.0);

    float speed = 1.5;

    // Multiple layers of stars
    for(float i = 0.0; i < 150.0; i++)
    {
        float seed = i;

        // Star base position
        float angle = hash(seed) * 6.28318;
        float dist = hash(seed + 10.0) * 1.5;

        // Depth
        float z = hash(seed + 20.0) * 8.0;
        z = mod(z - iTime * speed, 8.0);

        // Perspective
        float perspective = 1.0 / (z * 0.3 + 0.2);

        vec2 basePos = vec2(cos(angle), sin(angle)) * dist;
        vec2 starPos = basePos * perspective;

        // Distance to star
        float d = length(uv - starPos);

        // Star size (closer = bigger)
        float size = 0.003 * perspective;

        // Brightness
        float brightness = size / (d + size * 0.1);
        brightness = pow(brightness, 2.0);

        // Fade in/out as stars approach and pass
        float fade = smoothstep(8.0, 6.0, z) * smoothstep(0.0, 1.0, z);

        // Add star trail - INVERTED DIRECTION (from far to near)
        vec2 dir = -normalize(starPos); // Negative to reverse direction!
        float trailLength = (8.0 - z) * 0.05;

        // Check if we're in the trail
        float alongDir = dot(uv - starPos, dir);
        if(alongDir > 0.0 && alongDir < trailLength)
        {
            vec2 perpDir = vec2(-dir.y, dir.x);
            float perpDist = abs(dot(uv - starPos, perpDir));

            float trail = size * 0.3 / (perpDist + size);
            trail *= (1.0 - alongDir / trailLength);
            brightness += trail;
        }

        col += brightness * fade;
    }

    // Slight blue tint
    col.b += col.r * 0.15;

    fragColor = vec4(col, 1.0);
}