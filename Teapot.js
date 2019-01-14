/**
 * @fileoverview Teapot - A reflective and shading teapot
 * @author Zixin Zhang <zzhng151@illinois.edu>
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

// Create a place to store the texture coords 
var cube_tBuffer;

// Create a place to store vertices
var cube_vBuffer;

// Create a place to store the triangles
var cube_fBuffer;

// Create a place to store the Normals
var cube_nBuffer;

// Create a place to store the texture
var cubeImages = [];
var texture;

// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,0.1,1.0);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

// Create the normal
var nMatrix = mat3.create();

// Create ModelView matrix
var mvMatrix = mat4.create();

//Create Projection matrix
var pMatrix = mat4.create();

var mvMatrixStack = [];

var uIMatrix = mat3.create();

var teapot_y_rotation = 0;

var teapot_x_rotation = 0;
//Held down keys for interactivity
var currentlyPressedKeys= {}

var rotationSpeed = 0.05;
var rotationQuatLeft = quat.create();
var rotationQuatRight = quat.create();

var pitchSpeed = 0.05;
var rotationQuatUp = quat.create();
var rotationQuatDown = quat.create();
var sidewaysVec = vec3.create();

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [0.9,0.9,0.9];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0.4,0.4,0.4];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1.0,1.0,1.0];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[1.0,1.0,1.0];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [255.0/255.0,100.0/255.0,100.0/255.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [255.0/255.0,100.0/255.0,100.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [1.0,1.0,1.0];
/** @global Shininess exponent for Phong reflection */
var shininess = 60;

/**
 * Draw a cube based on buffers.
 */
function drawCube(){

  gl.bindBuffer(gl.ARRAY_BUFFER, cube_vBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
  gl.uniform1i(shaderProgram.uCubeSampler, 0);

  gl.uniform1i(shaderProgram.uIsCube, true);
  gl.uniform1i(shaderProgram.uIsReflect, false);
    
  // Bind normal buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, cube_nBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);   

  // Draw the cube.
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cube_fBuffer);
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
  
}

function drawTeapot(){
    if(myMesh.loaded()){
        gl.uniform1i(shaderProgram.uIsCube, false);
        gl.uniform1i(shaderProgram.uIsReflect, document.getElementById("to_reflect").checked);
        gl.uniform1i(shaderProgram.uIsShading, document.getElementById("to_shading").checked);
        myMesh.drawTriangles();
    }  
}

//Helper functions for drawing teapot
function asyncGetFile(url) {
  //Your code here
    console.log("Getting text file");
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.onload = () => resolve(xhr.responseText);
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send();
        console.log("Made promise");
    });
}

function setupMesh(filename) {
   //Your code here
    myMesh = new TriMesh();
    myPromise = asyncGetFile(filename);
    //We define what to do when the promise is resolved with then() call,
    //and what to do when the promise is rejected with catch() call
    myPromise.then((retrievedText) => {
        myMesh.loadFromOBJ(retrievedText);
        console.log("Yay! got the file");
    })
    .catch(
        //Log the rejection reason
        (reason) => {
            console.log('Handle rejected promise ('+reason+') here.');    
        });
}



function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(shaderProgram.uniformShininess, alpha);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColor, d);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColor, a);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColor, s);
  
}

function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}



//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
	mat3.normalFromMat4(nMatrix,mvMatrix);
	gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
	var copy = mat4.clone(mvMatrix);
	mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
	if (mvMatrixStack.length == 0) {
		throw "Invalid popMatrix!";
	}
	mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
	uploadModelViewMatrixToShader();
	uploadNormalMatrixToShader();
	uploadProjectionMatrixToShader();
    gl.uniformMatrix3fv(shaderProgram.uIMatrix, false, uIMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
	return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
	var names = ["webgl", "experimental-webgl"];
	var context = null;
	for (var i=0; i < names.length; i++) {
		try {
			context = canvas.getContext(names[i]);
		} catch(e) {}
		if (context) {
			break;
		}
	}
	if (context) {
		context.viewportWidth = canvas.width;
		context.viewportHeight = canvas.height;
	} else {
		alert("Failed to create WebGL context!");
	}
	return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
	var shaderScript = document.getElementById(id);
	
	// If we don't find an element with the specified id
	// we do an early exit 
	if (!shaderScript) {
		return null;
	}
	
	// Loop through the children for the found DOM element and
	// build up the shader source code as a string
	var shaderSource = "";
	var currentChild = shaderScript.firstChild;
	while (currentChild) {
		if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
			shaderSource += currentChild.textContent;
		}
		currentChild = currentChild.nextSibling;
	}
 
	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}
 
	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);
 
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	} 
	return shader;
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
	vertexShader = loadShaderFromDOM("shader-vs");
	fragmentShader = loadShaderFromDOM("shader-fs");
	
	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Failed to setup shaders");
	}

	gl.useProgram(shaderProgram);

	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aPosition");
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

	shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aNormal");
	gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

	shaderProgram.uCubeSampler = gl.getUniformLocation(shaderProgram, "uCubeSampler"); 
	shaderProgram.uIsCube = gl.getUniformLocation(shaderProgram, "uIsCube"); 
	shaderProgram.uIsReflect = gl.getUniformLocation(shaderProgram, "uIsReflect"); 
	shaderProgram.uIsShading = gl.getUniformLocation(shaderProgram, "uIsShading"); 

	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
	shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
	shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
	shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
	shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
	shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
	shaderProgram.uniformDiffuseMaterialColor = gl.getUniformLocation(shaderProgram, "uDiffuseMaterialColor");
	shaderProgram.uniformAmbientMaterialColor = gl.getUniformLocation(shaderProgram, "uAmbientMaterialColor");
	shaderProgram.uniformSpecularMaterialColor = gl.getUniformLocation(shaderProgram, "uSpecularMaterialColor");
	shaderProgram.uniformShininess = gl.getUniformLocation(shaderProgram, "uShininess"); 
    shaderProgram.uIMatrix= gl.getUniformLocation(shaderProgram, "uIMatrix");

}


//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupBuffers() {

  // Create a buffer for cube's vertices.
  cube_vBuffer = gl.createBuffer();

  // Bind cube_vBuffer

  gl.bindBuffer(gl.ARRAY_BUFFER, cube_vBuffer);

  var vertices = [
    // Right face
     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0,  1.0,  1.0,
     1.0, -1.0,  1.0,
    // Left face
    -1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0,
    -1.0,  1.0, -1.0,
    // Top face
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,
     1.0,  1.0,  1.0,
     1.0,  1.0, -1.0,
    // Bottom face
    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,
     1.0, -1.0,  1.0,
    -1.0, -1.0,  1.0,
    // Front face
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,
    // Back face
    -1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0, -1.0, -1.0	
  ];

  // Now pass the list of vertices into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Map the texture onto the cube's faces.

  cube_tBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cube_tBuffer);

  var textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Back
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Top
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Bottom
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Right
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Left
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.

  cube_fBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cube_fBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  var cubeVertexIndices = [
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);

  cube_nBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cube_nBuffer);

  gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array(vertices), gl.STATIC_DRAW);
}



//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() { 
	var transformVec = vec3.create();
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	// We'll use perspective 
	mat4.perspective(pMatrix,degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);
	// We want to look down -z, so create a lookat point in that direction    
	vec3.add(viewPt, eyePt, viewDir);
	// Then generate the lookat matrix and initialize the MV matrix to that view
	mat4.lookAt(mvMatrix,eyePt,viewPt,up);

	//Draw Terrain
	mvPushMatrix();
	mvPushMatrix();
    
    mat3.fromMat4(uIMatrix, mvMatrix);
    mat3.invert(uIMatrix,uIMatrix);
    
	setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);
	setMaterialUniforms(shininess,kAmbient, kTerrainDiffuse,kSpecular);
    if(texture){
        drawCube();
    }
    
    mvPopMatrix();
    mat4.rotateX(mvMatrix, mvMatrix, degToRad(teapot_x_rotation));
    mat4.rotateY(mvMatrix, mvMatrix, degToRad(teapot_y_rotation));
    
	mat4.scale(mvMatrix, mvMatrix, vec3.fromValues(0.08,0.08,0.08));
    if(texture){ //Remove NO unit 0 warning 
        drawTeapot();
    }
	mvPopMatrix();
}


function setupTextures() {
    
	var imgLoc = [
        "images/pos-x.png",
        "images/neg-x.png",
        "images/pos-y.png",
        "images/neg-y.png",
        "images/pos-z.png",
        "images/neg-z.png"
    ];
    var count = 0;
    var img = new Array(6);
    for (var i = 0; i < 6; i++) {
        img[i] = new Image();
        img[i].onload = function() {
            count++;
            if (count === 6) {
                texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                var targets = [
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X, 
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
                ];
                for (var j = 0; j < 6; j++) {
                    gl.texImage2D(targets[j], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img[j]);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                }
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    
            }
        }
        img[i].src = imgLoc[i];
    }
}



function handleKeys(){
	// left key
	if (currentlyPressedKeys[37]){
		quat.setAxisAngle(rotationQuatLeft, up, -rotationSpeed);
		vec3.transformQuat(eyePt, eyePt, rotationQuatLeft);
		vec3.transformQuat(viewDir, viewDir, rotationQuatLeft);
        //Move the light source with us
		vec3.transformQuat(lightPosition, lightPosition, rotationQuatLeft);
	}
	// right key
	if (currentlyPressedKeys[39]){
		quat.setAxisAngle(rotationQuatRight, up, rotationSpeed);
		vec3.transformQuat(eyePt, eyePt, rotationQuatRight);
		vec3.transformQuat(viewDir, viewDir, rotationQuatRight);
        //Move the light source with us
		vec3.transformQuat(lightPosition, lightPosition, rotationQuatRight);
	}
	// up key
	if (currentlyPressedKeys[38]){
		vec3.cross(sidewaysVec, up, viewDir);
		quat.setAxisAngle(rotationQuatUp, sidewaysVec, rotationSpeed);
		vec3.transformQuat(up, up, rotationQuatUp);
		vec3.transformQuat(eyePt, eyePt, rotationQuatUp);
		vec3.transformQuat(viewDir, viewDir, rotationQuatUp);
        //Move the light source with us
		vec3.transformQuat(lightPosition, lightPosition, rotationQuatUp);
	}
	// down key
	if (currentlyPressedKeys[40]){
		
		vec3.cross(sidewaysVec, up, viewDir);
		quat.setAxisAngle(rotationQuatDown, sidewaysVec, -rotationSpeed);
		vec3.transformQuat(up, up, rotationQuatDown);
		vec3.transformQuat(eyePt, eyePt, rotationQuatDown);
		vec3.transformQuat(viewDir, viewDir, rotationQuatDown);
        //Move the light source with us
		vec3.transformQuat(lightPosition, lightPosition, rotationQuatDown);
	}
    //a
    if (currentlyPressedKeys[65]){
        teapot_y_rotation -= 1;
	}
    //d
    if (currentlyPressedKeys[68]){
	   teapot_y_rotation += 1;
	}
    
    //w
    if (currentlyPressedKeys[87]){
        teapot_x_rotation -= 1;
	}
    //s
    if (currentlyPressedKeys[83]){
	   teapot_x_rotation += 1;
	}

}
 
//Code to handle user interaction
function handleKeyDown(event) {
	console.log("Key down ", event.key, " code ", event.code);
    event.preventDefault(); //Stop page scrolling 
    currentlyPressedKeys[event.keyCode] = true;
}


function handleKeyUp(event) {
	event.preventDefault(); //Stop page scrolling 
    console.log("Key up ", event.key, " code ", event.code);
    currentlyPressedKeys[event.keyCode] = false;
}


//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
	canvas = document.getElementById("myGLCanvas");
	document.onkeydown = handleKeyDown;
	document.onkeyup = handleKeyUp;
	gl = createGLContext(canvas);
	setupShaders();
    setupMesh("teapot_0.obj");
	setupBuffers();
	setupTextures();
	gl.clearColor(1.0, 1.0, 1.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	tick();
}

//----------------------------------------------------------------------------------
/**
 * Tick called for every animation frame.
 */
function tick() {
	requestAnimFrame(tick);
	draw();
	handleKeys();
}
