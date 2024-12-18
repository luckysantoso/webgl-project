"use strict";

import { vertexShaders, fragmentShaders } from "./shaders.js";
import { getGeometriesExtents, degToRad } from "./utils.js";
import { parseMTL, parseOBJ } from "./parseObj.js";

const defaultState = {
  cameraAngleX: 0.2,
  cameraAngleY: 89.5,
};

(async function initializeScene() {
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl");

  if (!gl) return;

  const shaderProgram = webglUtils.createProgramInfo(gl, [
    vertexShaders,
    fragmentShaders,
  ]);

  const objectURL = "./object/update.obj";
  const objectData = await fetch(objectURL).then((res) => res.text());
  const parsedOBJ = parseOBJ(objectData);

  const materialBaseURL = new URL(objectURL, window.location.href);
  const materialData = await Promise.all(
    parsedOBJ.materialLibs.map((file) =>
      fetch(new URL(file, materialBaseURL)).then((res) => res.text())
    )
  );
  const materials = parseMTL(materialData.join("\n"));

  const defaultMaterial = {
    diffuse: [1.0, 1.0, 1.0],
    ambient: [0.5, 0.5, 0.5],
    specular: [1.0, 1.0, 1.0],
    shininess: 100,
    opacity: 1.0,
    emissive: [0.1, 0.1, 0.1],
  };

  const geometries = parsedOBJ.geometries.map(({ material, data }) => {
    if (!data.color) data.color = { value: [1, 1, 1, 1] };
    return {
      material: materials[material] || defaultMaterial,
      bufferInfo: webglUtils.createBufferInfoFromArrays(gl, data),
    };
  });

  const bounds = getGeometriesExtents(parsedOBJ.geometries);
  const centerOffset = m4.scaleVector(
    m4.addVectors(
      bounds.min,
      m4.scaleVector(m4.subtractVectors(bounds.max, bounds.min), 0.5)
    ),
    -1
  );

  let cameraDistance =
    m4.length(m4.subtractVectors(bounds.max, bounds.min)) * 0.7;
  let cameraRotationX = defaultState.cameraAngleX,
    cameraRotationY = defaultState.cameraAngleY;

  const zoomLimits = {
    near: cameraDistance / 100,
    far: cameraDistance * 3,
    min: m4.length(m4.subtractVectors(bounds.max, bounds.min)) * 0.3,
    max: m4.length(m4.subtractVectors(bounds.max, bounds.min)) * 1.5,
  };

  const angleLimits = {
    minX: -Math.PI / 2.1,
    maxX: Math.PI / 2.1,
  };

  let isMouseDown = false;
  let previousMouse = { x: 0, y: 0 };

  canvas.addEventListener("mousedown", (event) => {
    isMouseDown = true;
    previousMouse = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!isMouseDown) return;
    const dx = event.clientX - previousMouse.x;
    const dy = event.clientY - previousMouse.y;

    cameraRotationY -= dx * 0.01;
    cameraRotationX = Math.max(
      angleLimits.minX,
      Math.min(angleLimits.maxX, cameraRotationX + dy * 0.01)
    );

    previousMouse = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener("mouseup", () => (isMouseDown = false));

  canvas.addEventListener("wheel", (event) => {
    cameraDistance *= event.deltaY > 0 ? 1.1 : 0.9;
    cameraDistance = Math.max(
      zoomLimits.min,
      Math.min(zoomLimits.max, cameraDistance)
    );
    event.preventDefault();
  });

  function renderScene() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const aspectRatio = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(
      degToRad(60),
      aspectRatio,
      zoomLimits.near,
      zoomLimits.far
    );

    const cameraPosition = [
      cameraDistance * Math.sin(cameraRotationY) * Math.cos(cameraRotationX),
      cameraDistance * Math.sin(cameraRotationX),
      cameraDistance * Math.cos(cameraRotationY) * Math.cos(cameraRotationX),
    ];

    const viewMatrix = m4.inverse(
      m4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0])
    );

    const sharedUniforms = {
      u_lightDirection: m4.normalize([1, 0.1, -1]),
      u_ambientLight: [0, 0, 0],
      u_view: viewMatrix,
      u_projection: projectionMatrix,
      u_viewWorldPosition: cameraPosition,
    };

    gl.useProgram(shaderProgram.program);
    webglUtils.setUniforms(shaderProgram, sharedUniforms);

    let worldMatrix = m4.translate(m4.identity(), ...centerOffset);

    geometries.forEach(({ bufferInfo, material }) => {
      webglUtils.setBuffersAndAttributes(gl, shaderProgram, bufferInfo);
      webglUtils.setUniforms(shaderProgram, { u_world: worldMatrix }, material);
      webglUtils.drawBufferInfo(gl, bufferInfo);
    });

    requestAnimationFrame(renderScene);
  }

  renderScene();
})();
