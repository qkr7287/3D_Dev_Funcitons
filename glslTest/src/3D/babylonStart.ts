import * as BABYLON from '@babylonjs/core'
import { runBoxGridShader } from './glsl'

export function start(): void {
    // Canvas 요소 가져오기
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement

    // Babylon.js 엔진 생성
    const engine = new BABYLON.Engine(canvas, true)

    // 씬 생성
    const scene = new BABYLON.Scene(engine)

    // ArcRotateCamera 생성 (중앙을 중심으로 회전하는 카메라)
    const camera = new BABYLON.ArcRotateCamera(
        'camera',
        -Math.PI / 2, // alpha (수평 회전)
        Math.PI / 2.5, // beta (수직 회전)
        10, // radius (거리)
        BABYLON.Vector3.Zero(), // target (중심점)
        scene
    )

    // 카메라를 캔버스에 연결
    camera.attachControl(canvas, true)

    // 조명 생성
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)
    light.intensity = 0.7

    runBoxGridShader(scene, {
        gridNum: 10,
        cellValues: [[0.5, 0.3, 0.7], [0.2, 0.8, 0.4]],
        lineThickness: 0.02
    })

    // 렌더링 루프 시작
    engine.runRenderLoop(() => {
        scene.render()
    })

    // 윈도우 리사이즈 처리
    window.addEventListener('resize', () => {
        engine.resize()
    })
}
