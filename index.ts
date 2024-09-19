
const EPSILON = 1e-6;
const NEAR_CLIPPING_PLANE = 0.25;
const FAR_CLIPPING_PLANE = 10.0;
const FOV = Math.PI * 0.5;  // == 90˚
const SCREEN_WIDTH = 2000;
const PLAYER_STEP_LEN = 0.5;
const PLAYER_SPEED = 3;

class Color {   // rgb 0-255, a 0-1
    r: number;
    g: number;
    b: number;
    a: number;

    constructor(r: number, g: number, b: number, a: number,) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    static red(): Color {    return new Color(1, 0, 0, 1); }
    static green(): Color {  return new Color(0, 1, 0, 1); }
    static blue(): Color {   return new Color(0, 0, 1, 1); }
    static yellow(): Color { return new Color(1, 1, 0, 1); }
    static purple(): Color { return new Color(1, 0, 1, 1); }
    static cyan(): Color {   return new Color(0, 1, 1, 1); }

    
    brightness(factor: number): Color {
        return new Color(factor*this.r, factor*this.g, factor*this.b, this.a)
    }
    
    toStyle(): string {
        return `rgba(` + `${Math.floor(this.r*255)},`
                       + `${Math.floor(this.g*255)},`
                       + `${Math.floor(this.b*255)},`
                       + `${this.a})`;
    }
}

class Vector2 {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    static zero(): Vector2 {
        return new Vector2(0, 0);
    }
    static fromAngle(angle: number): Vector2 {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }
    array(): [number, number] {
        return [this.x, this.y];
    }
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    // not necessary to do sqrt on each frame, so heres a new 
    // function for faster calculations during rendering 
    sqrLength(): number {
        return this.x * this.x + this.y * this.y;
    }

    norm(): Vector2 {
        const l = this.length();
        if (l === 0) return new Vector2(0, 0);
        return new Vector2(this.x/l, this.y/l);
    }
    scale(value: number): Vector2 {
        return new Vector2(this.x*value, this.y*value);
    }
    distanceTo(that: Vector2): number { // not needed
        return that.sub(this).length();
    }
    // same thing switching to not sqrt ing 
    sqrDistanceTo(that: Vector2): number {
        return that.sub(this).sqrLength();
    }
 
    rot90(): Vector2 {
        return new Vector2(-this.y, this.x);
    }
    lerp(that: Vector2, t: number): Vector2 {
        return that.sub(this).scale(t).add(this);
    }
    dot(that: Vector2): number {
        return this.x * that.x + this.y * that.y;
    }
    div(that: Vector2): Vector2 {
        return new Vector2(this.x/that.x, this.y/that.y);
    }
    mul(that: Vector2): Vector2 {
        return new Vector2(this.x*that.x, this.y*that.y);
    }
    sub(that: Vector2): Vector2 {
        return new Vector2(this.x-that.x, this.y-that.y);
    }
    add(that: Vector2): Vector2 {
        return new Vector2(this.x+that.x, this.y+that.y);
    }
}

class Player {
    position: Vector2;
    direction: number;
    constructor(position: Vector2, direction: number) {
        this.position = position;
        this.direction = direction;
    }
    fovRange(): [Vector2, Vector2] {
        const l = Math.tan(FOV*0.5) * NEAR_CLIPPING_PLANE;
        const p = this.position.add(Vector2.fromAngle(this.direction).scale(NEAR_CLIPPING_PLANE));
        const p1 = p.sub(p.sub(this.position).rot90().norm().scale(l));
        const p2 = p.add(p.sub(this.position).rot90().norm().scale(l));
        return [p1, p2];
    }
}

function canvasSize(ctx: CanvasRenderingContext2D): Vector2 {
    return new Vector2(ctx.canvas.width, ctx.canvas.height)
}

function fillCircle(ctx: CanvasRenderingContext2D, center: Vector2, radius: number) {
    ctx.beginPath();
    ctx.arc(...center.array(), radius, 0, 2*Math.PI);
    ctx.fill();
}

function strokeLine(ctx: CanvasRenderingContext2D, p1: Vector2, p2: Vector2) {
    ctx.beginPath();
    ctx.moveTo(...p1.array());
    ctx.lineTo(...p2.array());
    ctx.stroke();
}

function snap(x: number, dx: number): number {
    //since value can already be snapped, need to nudge it
    if (dx > 0) return Math.ceil(x + Math.sign(dx) * EPSILON);
    if (dx < 0) return Math.floor(x + Math.sign(dx) * EPSILON);
    return x;  // (else x is 0)
}

function hittingCell(p1: Vector2, p2: Vector2): Vector2 {
    const d = p2.sub(p1);
    let xHit = Math.floor(p2.x + Math.sign(d.x) * EPSILON);
    let yHit = Math.floor(p2.y + Math.sign(d.y) * EPSILON);
    return new Vector2(xHit, yHit);
}

// this approach manually handles all edge cases
function rayStep(p1: Vector2, p2: Vector2): Vector2 {
    let p3 = p2;
    const d = p2.sub(p1);

    if (d.x !== 0) {
        const k = d.y / d.x;
        const c = p1.y - k * p1.x;

        const x3 = snap(p2.x, d.x);
        const y3 = x3 * k + c;
        p3 = new Vector2(x3, y3);

        if (k !== 0) {
            const y3_snap = snap(p2.y, d.y);
            const x3_snap = (y3_snap - c) / k;
            const p3_snap = new Vector2(x3_snap, y3_snap);
            // pick closest
            if (p2.sqrDistanceTo(p3_snap) < p2.sqrDistanceTo(p3)) {
                p3 = p3_snap;
            }
        }
    } else {
        const y3 = snap(p2.y, d.y); // not sure if this is necessary 
        const x3 = p2.x;            // for when there is no change in x
        p3 = new Vector2(x3, y3);
    }
    return p3;
}


type Scene = Array<Array<Color | HTMLImageElement | null>>;


function insideScene(scene: Scene, p: Vector2): boolean {
    const size = sceneSize(scene);
    return 0 <= p.x && p.x < size.x && 0 <= p.y && p.y < size.y;
}

function castRay(scene: Scene, p1: Vector2, p2: Vector2): Vector2 {
    let start = p1;
    while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE*FAR_CLIPPING_PLANE) { // (avoiding sqrt)
        const c = hittingCell(p1, p2);
        if (insideScene(scene, c) && scene[c.y][c.x] !== null) break;
        const p3 = rayStep(p1, p2);
        p1 = p2;
        p2 = p3;
    }
    return p2;
}

function sceneSize(scene: Scene): Vector2 {
    const y = scene.length;
    let x = Number.MIN_VALUE;
    
    for (let row of scene) {
        x = Math.max(x, row.length);
    }
    return new Vector2(x, y);
}

function renderMinimap(ctx: CanvasRenderingContext2D, 
                 player:   Player,
                 position: Vector2,
                 size:     Vector2,
                 scene:    Scene)
                 
{  
    ctx.save();

    const gridSize = sceneSize(scene);

    ctx.translate(...position.array());             // bugs here?? (order?)
    ctx.scale(...size.div(gridSize).array());
    
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, ...gridSize.array());
    ctx.lineWidth = 0.1;

    for (let y = 0; y < gridSize.y; ++y) {
        for (let x = 0; x < gridSize.x; ++x) {
            const cell = scene[y][x];
    
            if (cell instanceof Color) {
                ctx.fillStyle = cell.toStyle();
                ctx.fillRect(x, y, 1, 1);
            } else if (cell instanceof HTMLImageElement) {
                ctx.drawImage(cell, x, y, 1, 1);
            }
        }
    }

    ctx.strokeStyle = "#303030";
    for (let x = 0; x <= gridSize.x; ++x) {
        strokeLine(ctx, new Vector2(x, 0), new Vector2(x, gridSize.y));
    }
    for (let y = 0; y <= gridSize.y; ++y) {
        strokeLine(ctx, new Vector2(0, y), new Vector2(gridSize.x, y));
    }
    
    ctx.fillStyle = "magenta";
    fillCircle(ctx, player.position, 0.2);
    
    const [p1, p2] = player.fovRange();
    
    ctx.strokeStyle = "magenta";
    strokeLine(ctx, player.position, p1);
    strokeLine(ctx, p1, p2);
    strokeLine(ctx, player.position, p1);
    strokeLine(ctx, player.position, p2);
    
    ctx.restore();
    }

function distancePointToLine(p1: Vector2, p2: Vector2, p0: Vector2): number {
    const A: number = p2.y - p1.y;
    const B: number = p1.x - p2.x;
    const C: number = p2.x * p1.y - p1.x * p2.y;
    return Math.abs((A * p0.x + B * p0.y + C) / Math.sqrt(A ** 2 + B ** 2));
}

function renderScene(ctx: CanvasRenderingContext2D, player: Player, scene: Scene) {
    const stripWidth = Math.ceil(ctx.canvas.width/SCREEN_WIDTH);
    const [r1, r2] = player.fovRange();
    for (let x = 0; x < SCREEN_WIDTH; ++x) {
        
        const p = castRay(scene, player.position, r1.lerp(r2, x/SCREEN_WIDTH));
        const c = hittingCell(player.position, p);
       
        if (insideScene(scene, c)) {
            const cell = scene[c.y][c.x];
            if (cell instanceof Color) {
                const v = p.sub(player.position);
                const d = Vector2.fromAngle(player.direction);
                const stripHeight = ctx.canvas.height / v.dot(d);
                ctx.fillStyle = cell.brightness(1/v.dot(d)).toStyle(); // shades
                ctx.fillRect(x*stripWidth, 
                             (ctx.canvas.height - stripHeight)*0.5, 
                             stripWidth, stripHeight);
            } else if (cell instanceof HTMLImageElement) {

                const v = p.sub(player.position);
                const d = Vector2.fromAngle(player.direction);
                const stripHeight = ctx.canvas.height / v.dot(d);
                
                let u = 0;
                const t = p.sub(c);
                if ((Math.abs(t.x) < EPSILON || Math.abs(t.x - 1) < EPSILON) && t.y > 0) {
                    u = t.y;
                } else {
                    u = t.x
                }

                ctx.drawImage(cell, u*cell.width, 0, 1, cell.height, x*stripWidth, (ctx.canvas.height - stripHeight)*0.5, stripWidth, stripHeight);
            }
        }
    }
}

function renderGame(ctx: CanvasRenderingContext2D, player: Player, scene: Scene) {
    const minimapPosition = Vector2.zero().add(canvasSize(ctx).scale(0.03));
    const cellSize = ctx.canvas.width * 0.04;
    const minimapSize = sceneSize(scene).scale(cellSize);

    ctx.fillStyle = "#181810";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    renderScene(ctx, player, scene);
    renderMinimap(ctx, player, minimapPosition, minimapSize, scene);
}


async function loadImageData(url: string): Promise <HTMLImageElement> {
    const image = new Image();
    image.src = url;

    return new Promise((resolve, reject) => {
        // once image loads, do the following:
        image.onload = () => resolve(image);
        image.onerror = reject; // else reject the Promise
    });
}   
    



(async () => {
    const game = document.getElementById("game") as (HTMLCanvasElement | null);
    if (game === null) throw new Error("No canvas with id 'game' is found");

    const factor = 90;
    game.width = 16 * factor;
    game.height = 9 * factor;

    const ctx = game.getContext("2d");
    if (ctx === null) throw new Error("2d cotext is not supported");
    ctx.imageSmoothingEnabled = false; // why was this on



    // loading first image
    const kkr = await loadImageData("images/kkr.png");
    const scull = await loadImageData("images/scull.png");



    const scene = [
        [Color.blue(), null, Color.purple(), kkr, Color.red(), null, Color.cyan(), Color.green()],
        [kkr, null, null, null, null, null, null, null],
        [null, null, null, null, null, scull, null, Color.purple()],
        [null, null, Color.red(), null, null, null, null, null],
        [null, null, null, kkr, null, Color.yellow(), null, Color.green()],
        [null, null, null, null, null, null, null, kkr],
        [null, null, null, null, null, null, null, null],
        [Color.blue(), Color.cyan(), Color.purple(), Color.green(), null, Color.yellow(), null, Color.green()]];



    // Player Start Position 
    const pos = sceneSize(scene).mul(new Vector2(0.0, 0.76));  
    const dir = Math.PI * 1.9;
    const player = new Player(pos, dir);
    

    // new movement
    let movingForward  = false;
    let movingBackward = false;
    let turningLeft  = false;
    let turningRight = false;

    window.addEventListener("keydown", (e) => {
        if (!e.repeat) {
            console.log(e);
            console.log(e.code);
            switch (e.code) {
                case 'KeyW': movingForward  = true; break;
                case 'KeyS': movingBackward = true; break;
                case 'KeyD': turningRight = true; break;
                case 'KeyA': turningLeft  = true; break;
            }
        }
    });
    window.addEventListener("keyup", (e) => {
        if (!e.repeat) {
            switch (e.code) {
                case 'KeyW': movingForward  = false; break;
                case 'KeyS': movingBackward = false; break;
                case 'KeyD': turningRight = false; break;
                case 'KeyA': turningLeft  = false; break;
            }
        }
    })

    
    // Adding graphics 
    let prevTimestamp = 0;
    
    const frame = (timestamp: number) => {
        const deltaTime = (timestamp - prevTimestamp)/1000;
        prevTimestamp = timestamp;
        let velocity = Vector2.zero();
        let angularVelocity = 0.0;
        
        if (movingForward) {
            velocity = velocity.add(Vector2.fromAngle(player.direction)
                                    .scale(PLAYER_SPEED));
        }
        if (movingBackward) {
            velocity = velocity.sub(Vector2.fromAngle(player.direction)
                                    .scale(PLAYER_SPEED));
        }
        if (turningLeft) {
            angularVelocity -= Math.PI * 0.8;
        }
        if (turningRight) {
            angularVelocity += Math.PI * 0.8;
        }

        player.direction += angularVelocity * deltaTime;
        player.position = player.position.add(velocity.scale(deltaTime));
        renderGame(ctx, player, scene);
        window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame((timestamp) => {
        prevTimestamp = timestamp;
        window.requestAnimationFrame(frame);
    });
    
})()

