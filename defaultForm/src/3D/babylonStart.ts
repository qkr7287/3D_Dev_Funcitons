import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, MeshBuilder, Color3, StandardMaterial } from '@babylonjs/core'

export function start(): void {
    // Canvas 요소 가져오기
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement

    // Babylon.js 엔진 생성
    const engine = new Engine(canvas, true)

    // 씬 생성
    const scene = new Scene(engine)

    // ArcRotateCamera 생성 (중앙을 중심으로 회전하는 카메라)
    const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2, // alpha (수평 회전)
        Math.PI / 2.5, // beta (수직 회전)
        10, // radius (거리)
        Vector3.Zero(), // target (중심점)
        scene
    )

    // 카메라를 캔버스에 연결
    camera.attachControl(canvas, true)

    // 조명 생성
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    light.intensity = 0.7

    // 중앙에 박스 생성
    const box = MeshBuilder.CreateBox('box', { size: 2 }, scene)
    box.position = Vector3.Zero() // 중앙에 위치

    // 박스에 색상 적용
    const material = new StandardMaterial('boxMaterial', scene)
    material.diffuseColor = new Color3(0.4, 0.6, 1.0) // 파란색
    box.material = material

    // 렌더링 루프 시작
    engine.runRenderLoop(() => {
        scene.render()
    })

    // 윈도우 리사이즈 처리
    window.addEventListener('resize', () => {
        engine.resize()
    })
}
