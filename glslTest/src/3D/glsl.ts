import * as BABYLON from '@babylonjs/core'

// GLSL 셰이더 코드
const vertexShader = `

attribute vec3 position;
attribute vec2 uv;

uniform mat4 worldViewProjection;

varying vec2 vUV;

void main() {
    vUV = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`

const fragmentShader = `
// Author @patriciogv - 2015

#ifdef GL_ES
precision mediump float;
#endif

varying vec2 vUV;

uniform float u_time;
uniform float u_gridNum;          // 셀 개수 (정사각형 그리드)
uniform sampler2D u_gridValues;   // gridNum x gridNum 크기의 데이터 텍스처
uniform float u_lineThickness;    // 0.0~0.2 정도 권장

void main() {
    // 0~1의 UV를 그리드 좌표계로 확장
    vec2 pos = vUV * u_gridNum;
    vec2 i_st = floor(pos);         // 셀 인덱스
    vec2 f_st = fract(pos);         // 셀 내부 좌표

    // 셀 인덱스를 이용해 데이터 텍스처에서 해당 셀의 스칼라 값 읽기
    // 텍스처 좌표는 픽셀 센터로 접근 (i + 0.5)/gridNum
    vec2 texUV = (i_st + 0.5) / u_gridNum;
    float cell_value = texture2D(u_gridValues, texUV).r; // 0~1

    // 색 변환: R=cell_value, B=1.0-cell_value (G=0)
    float R = cell_value;
    float B = 1.0 - cell_value;
    vec3 color = vec3(R, 0.0, B);

    // 그리드 라인 (검정)
    float lineX = 1.0 - step(u_lineThickness, f_st.x);
    float lineY = 1.0 - step(u_lineThickness, f_st.y);
    float grid_line_mask = max(lineX, lineY);

    color = mix(color, vec3(0.0), grid_line_mask);
    gl_FragColor = vec4(color, 1.0);
}
`
// 2D -> 1D 인덱싱 유틸
const idx = (x: number, y: number, size: number) => y * size + x;

import {
    RawTexture,
    ShaderMaterial,
    MeshBuilder,
    Texture,
    Constants,
    Engine,
    Scene,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
} from '@babylonjs/core';

// gridNum x gridNum의 0~1 스칼라 값을 Babylon RawTexture(R) 로 생성
export function createGridTexture(scene: Scene, gridNum: number, values2D?: number[][]) {
    const size = gridNum;
    const data = new Uint8Array(size * size);

    for (let y = 0; y < size; y++) {
        // 행이 없으면 기본 행 생성
        const row = values2D?.[y];
        for (let x = 0; x < size; x++) {
            // 값이 없으면 간단한 그라데이션 기본값 사용
            const fallback = (x + y) / (2 * (size - 1));
            const raw = row?.[x];
            const v = Math.min(1, Math.max(0, raw ?? fallback));
            data[idx(x, y, size)] = Math.floor(v * 255);
        }
    }

    const tex = RawTexture.CreateRTexture(
        data,
        size,
        size,
        scene,
        false,                               // generateMipMaps
        false,                               // invertY
        Texture.NEAREST_SAMPLINGMODE,        // 그리드 값 샘플은 NEAREST 권장
        Constants.TEXTURETYPE_UNSIGNED_BYTE  // 8bit (Uint8Array)
    );
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    return tex;
}

// 값 변경 시 텍스처 업데이트
export function updateGridTexture(tex: RawTexture, newValues2D: number[][]) {
    const size = tex.getSize().width;
    const data = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const v = Math.min(1, Math.max(0, newValues2D[y][x] ?? 0));
            data[idx(x, y, size)] = Math.floor(v * 255);
        }
    }
    tex.update(data);
}

// GLSL grid 박스 생성/적용을 쉽게 하는 함수 (run 함수처럼 사용)
export async function runBoxGridShader(scene: Scene, userOptions?: {
    gridNum?: number,
    cellValues?: number[][],
    lineThickness?: number,
    onBoxReady?: (box: BABYLON.Mesh, gridTex: RawTexture, values: number[][], update: (tex: RawTexture, values2D: number[][]) => void) => void
}) {


    const box = MeshBuilder.CreateBox("box", { size: 2 }, scene);

    // --- 초기 그리드 데이터 준비 ---
    const gridNum = userOptions?.gridNum ?? 10;
    // cellValues를 사용하거나, 없으면 대각선 그라데이션
    const values: number[][] = userOptions?.cellValues
        ?? Array.from({ length: gridNum }, (_, j) =>
            Array.from({ length: gridNum }, (_, i) => {
                return (i + j) / (2 * (gridNum - 1));
            })
        );

    // --- 데이터 텍스처 생성 ---
    const gridTex = createGridTexture(scene, gridNum, values);

    // --- 셰이더 등록 (Babylon은 소스 문자열을 ShaderMaterial에 직접 전달 가능) ---
    const vertexSource = `
    precision mediump float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    varying vec2 vUV;
    void main() {
      vUV = uv;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;

    const fragmentSource = `
    #ifdef GL_ES
    precision mediump float;
    #endif
    varying vec2 vUV;
    uniform float u_time;
    uniform float u_gridNum;
    uniform sampler2D u_gridValues;
    uniform float u_lineThickness;
    void main() {
      vec2 pos = vUV * u_gridNum;
      vec2 i_st = floor(pos);
      vec2 f_st = fract(pos);

      vec2 texUV = (i_st + 0.5) / u_gridNum;
      float cell_value = texture2D(u_gridValues, texUV).r;

      float R = cell_value;
      float B = 1.0 - cell_value;
      vec3 color = vec3(R, 0.0, B);

      float lineX = 1.0 - step(u_lineThickness, f_st.x);
      float lineY = 1.0 - step(u_lineThickness, f_st.y);
      float grid_line_mask = max(lineX, lineY);

      color = mix(color, vec3(0.0), grid_line_mask);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

    const shader = new ShaderMaterial(
        "gridShader",
        scene,
        { vertexSource, fragmentSource },
        {
            attributes: ["position", "uv"],
            uniforms: ["worldViewProjection", "u_time", "u_gridNum", "u_lineThickness"],
            samplers: ["u_gridValues"],
        }
    );

    shader.setFloat("u_gridNum", gridNum);
    shader.setFloat("u_lineThickness", userOptions?.lineThickness ?? 0.05); // 셀 내부 라인 두께
    shader.setTexture("u_gridValues", gridTex);

    // 시간 전달 (애니메이션)
    let t = 0;
    scene.onBeforeRenderObservable.add(() => {
        t += scene.getEngine().getDeltaTime() * 0.001;
        shader.setFloat("u_time", t);
    });

    box.material = shader;

    // box와 텍스처를 사용자에게 전달 (커스텀 편집/조작시 활용)
    userOptions?.onBoxReady?.(box, gridTex, values, updateGridTexture);
}

