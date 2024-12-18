"use strict";

export function parseOBJ(text) {
  const positions = [[0, 0, 0]];
  const texcoords = [[0, 0]];
  const normals = [[0, 0, 0]];
  const colors = [[0, 0, 0]];

  const vertexData = [positions, texcoords, normals, colors];

  let webglData = [[], [], [], []];

  const materialLibraries = [];
  const shapes = [];
  let currentShape;
  let currentGroups = ["default"];
  let currentMaterial = "default";
  let currentObject = "default";

  const noop = () => {};

  function createNewShape() {
    if (currentShape && currentShape.data.position.length) {
      currentShape = undefined;
    }
  }

  function ensureShape() {
    if (!currentShape) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglData = [position, texcoord, normal, color];
      currentShape = {
        object: currentObject,
        groups: currentGroups,
        material: currentMaterial,
        data: {
          position,
          texcoord,
          normal,
          color,
        },
      };
      shapes.push(currentShape);
    }
  }

  function addVertexData(vertex) {
    const indices = vertex.split("/");
    indices.forEach((indexStr, i) => {
      if (!indexStr) return;
      const index = parseInt(indexStr);
      const adjustedIndex = index + (index >= 0 ? 0 : vertexData[i].length);
      webglData[i].push(...vertexData[i][adjustedIndex]);
      if (i === 0 && colors.length > 1) {
        currentShape.data.color.push(...colors[adjustedIndex]);
      }
    });
  }

  const handlers = {
    v(parts) {
      if (parts.length > 3) {
        positions.push(parts.slice(0, 3).map(parseFloat));
        colors.push(parts.slice(3).map(parseFloat));
      } else {
        positions.push(parts.map(parseFloat));
      }
    },
    vn(parts) {
      normals.push(parts.map(parseFloat));
    },
    vt(parts) {
      texcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      ensureShape();
      const triangleCount = parts.length - 2;
      for (let i = 0; i < triangleCount; ++i) {
        addVertexData(parts[0]);
        addVertexData(parts[i + 1]);
        addVertexData(parts[i + 2]);
      }
    },
    s: noop,
    mtllib(parts, unparsedArgs) {
      materialLibraries.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      currentMaterial = unparsedArgs;
      createNewShape();
    },
    g(parts) {
      currentGroups = parts;
      createNewShape();
    },
    o(parts, unparsedArgs) {
      currentObject = unparsedArgs;
      createNewShape();
    },
  };

  const keywordRegex = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = keywordRegex.exec(line);
    if (!match) continue;
    const [, keyword, unparsedArgs] = match;
    const parts = line.split(/\s+/).slice(1);
    const handler = handlers[keyword];
    if (!handler) {
      console.warn("Unhandled keyword:", keyword);
      continue;
    }
    handler(parts, unparsedArgs);
  }

  for (const shape of shapes) {
    shape.data = Object.fromEntries(
      Object.entries(shape.data).filter(([, array]) => array.length > 0)
    );
  }

  return {
    geometries: shapes,
    materialLibs: materialLibraries,
  };
}

export function parseMapArgs(unparsedArgs) {
  return unparsedArgs;
}

export function parseMTL(text) {
  const materials = {};
  let currentMaterial;

  const handlers = {
    newmtl(parts, unparsedArgs) {
      currentMaterial = {};
      materials[unparsedArgs] = currentMaterial;
    },
    Ns(parts) {
      currentMaterial.shininess = parseFloat(parts[0]);
    },
    Ka(parts) {
      currentMaterial.ambient = parts.map(parseFloat);
    },
    Kd(parts) {
      currentMaterial.diffuse = parts.map(parseFloat);
    },
    Ks(parts) {
      currentMaterial.specular = parts.map(parseFloat);
    },
    Ke(parts) {
      currentMaterial.emissive = parts.map(parseFloat);
    },
    Ni(parts) {
      currentMaterial.opticalDensity = parseFloat(parts[0]);
    },
    d(parts) {
      currentMaterial.opacity = parseFloat(parts[0]);
    },
    illum(parts) {
      currentMaterial.illum = parseInt(parts[0]);
    },
  };

  const keywordRegex = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = keywordRegex.exec(line);
    if (!match) continue;
    const [, keyword, unparsedArgs] = match;
    const parts = line.split(/\s+/).slice(1);
    const handler = handlers[keyword];
    if (!handler) {
      console.warn("Unhandled keyword:", keyword);
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}
