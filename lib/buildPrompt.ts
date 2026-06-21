// Pure prompt builder for sticker image generation. Lives outside the
// Next.js route module because route files only accept specific exports
// (POST/GET/etc.) — exporting helpers from `app/api/.../route.ts` breaks
// the generated Next.js type-checker.

const automaticPromptAppendix = `
**AUTOMATIC PROMPT APPENDIX (MUST FOLLOW)**:

- 이미지는 외곽 15px를 남기고 가득차게 채워주세요.

- 귀엽고 생동감 있는 캐릭터 일러스트를 꽉찬 배경 JPG 스티커 스타일로 생성해주세요. (배경만 투명이고, 그림 내부는 꽉 채울것.)
- 캐릭터는 친근하고 밝은 분위기이며, 포즈와 표정은 활기차고 자신감 있는 느낌으로 표현해주세요.
- 전체 그림체는 깔끔하고 사랑스러운 일러스트 스타일로, 스티커처럼 완성도 높게 마감해주세요.

- 이미지 안에는 장면의 분위기와 그림체에 자연스럽게 어울리는 짧은 감성 문구를 AI가 직접 만들어 넣어주세요.
- 문구는 별도 합성 텍스트처럼 보이지 않게, 일러스트의 일부처럼 자연스럽게 직접 그려진 형태여야 합니다.
- 글씨체는 예쁜 손글씨 캘리그래피 스타일로, 부드럽고 따뜻하며 정성스럽게 쓴 느낌으로 표현해주세요.
- 획은 자연스럽고 약간의 손글씨 불규칙성이 있으며, 전체 그림체와 조화를 이루어야 합니다.
- 문구는 너무 길지 않게, 짧고 귀엽고 감성적인 한 줄 문장으로 작성해주세요.

- 이 이미지는 라이트 모드와 다크 모드, 흰색 배경과 검은색 배경 모두에서 일관되게 잘 보이는 투명 PNG 스티커로 제작해주세요.
- 배경은 완전히 투명하게 유지해주세요.

- 캐릭터와 텍스트 전체 바깥쪽에는 두꺼운 흰색 스티커 외곽선을 넣고, 그 바깥쪽에는 아주 얇은 중간 회색 또는 어두운 회색 보조 외곽선을 추가해주세요.
- 이중 외곽선 구조를 사용해서, 흰색 배경에서도 경계가 사라지지 않고, 검은색 배경에서도 캐릭터와 텍스트가 묻히지 않도록 해주세요.

- 어두운 색상의 머리카락, 의상, 선, 손글씨 문구는 다크 배경에서 사라지지 않도록 가장자리에 은은한 밝은 하이라이트 또는 림라이트를 넣어주세요.
- 밝은 부분은 흰색 배경에서 경계가 흐려지지 않도록 얇은 회색 경계선을 유지해주세요.
- 텍스트 역시 어떤 배경에서도 읽기 쉽도록 얇은 밝은 테두리 또는 작은 그림자를 넣어 가독성을 확보해주세요.

- 텍스트와 캐릭터는 하나의 완성된 스티커처럼 보이도록 구성해주세요.
- 중요한 피사체를 가리지 않도록 문구를 적절한 위치에 배치하고, 전체적으로 균형 잡힌 구도로 마감해주세요.
- 흰색 사각 배경, 검은색 배경판, 단색 박스 배경은 넣지 말고, 배경은 반드시 완전 투명하게 유지해주세요.

Avoid generic printed fonts, subtitle-like text, watermark-like text, or UI typography.
The handwritten text must be clearly legible, beautiful, and naturally integrated into the artwork.
Create a polished transparent PNG sticker that remains clearly visible on both light mode and dark mode backgrounds.
`;

export const buildPrompt = (
  characterDesc: string,
  scenarioPrompt: string,
  style: string,
  hasReference: boolean,
  composition?: string
): string => {
  const referenceInstruction = hasReference
    ? "**REFERENCE IMAGE INSTRUCTION**: Extract ONLY the character's physical features (species, clothes, colors) from the reference image. **COMPLETELY IGNORE** the reference's lighting, shading, shadows, and 3D style. Re-draw the character as a **FLAT 2D VECTOR STICKER**."
    : '';

  const compositionBlock = composition
    ? `**FRAMING (MUST FOLLOW)**: ${composition}`
    : '**FRAMING**: Standard centered bust-up framing.';

  return `
    Design a **FLAT DIE-CUT STICKER** asset.

    **SUBJECT**: ${characterDesc}
    **ACTION/EMOTION**: ${scenarioPrompt}
    **ART STYLE**: ${style}

    ${compositionBlock}

    **MANDATORY RENDERING RULES (STRICT NO-SHADOW POLICY)**:
    1. **ABSOLUTELY NO SHADOWS**:
       - **NO CONTACT SHADOW** (gray oval under feet).
       - **NO DROP SHADOW** behind the character.
       - **NO CAST SHADOW** on the ground.
    2. **NO FLOOR**: The character must appear to be **floating in a white void**. Do not render a ground plane, horizon line, or surface.
    3. **FLAT VECTOR STYLE**:
       - Use **solid, flat colors** only (Cel Shading).
       - **NO GRADIENTS**.
       - **NO AMBIENT OCCLUSION** (darkening in corners).
       - Use clean, bold, continuous outlines.

    **COMPOSITION**:
    - Honor the FRAMING rule above. The character must remain fully visible
      and readable when shrunk to a 96x74 chat thumbnail.
    - White background (#FFFFFF).

    ${referenceInstruction}

    ${automaticPromptAppendix}

    **NEGATIVE PROMPT**:
    shadow, contact shadow, drop shadow, cast shadow, floor, ground, surface, horizon, 3d, realistic, photorealistic, gradient, texture, noise, blur, gray background, vignette, multiple characters, busy background, cropped face, awkward crop.
  `;
};
