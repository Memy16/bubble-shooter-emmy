window.onload = function() {
    
    let canvas = document.getElementById("viewport");
    let context = canvas.getContext("2d");
    
    let lastframe = 0;
    let fpstime = 0;
    let framecount = 0;
    let fps = 0;

    let backgroundMusic = new Audio('assets/sounds/dynamite-pista.mp3');
    backgroundMusic.loop = true;

    
    let initialized = false;
    
    let level = {
        x: 4,           
        y: 83,          
        width: 0,       
        height: 0,      
        columns: 15,    
        rows: 14,       
        tilewidth: 40,  
        tileheight: 40, 
        rowheight: 34,  
        radius: 20,     
        tiles: []       
    };

    let Tile = function(x, y, type, shift) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.removed = false;
        this.shift = shift;
        this.velocity = 0;
        this.alpha = 1;
        this.processed = false;
    };
    
    let player = {
        x: 0,
        y: 0,
        angle: 0,
        tiletype: 0,
        bubble: {
                    x: 0,
                    y: 0,
                    angle: 0,
                    speed: 1000,
                    dropspeed: 900,
                    tiletype: 0,
                    visible: false
                },
        nextbubble: {
                        x: 0,
                        y: 0,
                        tiletype: 0
                    }
    };
    
    let neighborsoffsets = [[[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]], 
                            [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]];  
    
    let bubblecolors = 7;
    
    let gamestates = { init: 0, ready: 1, shootbubble: 2, removecluster: 3, gameover: 4 };
    let gamestate = gamestates.init;
    
    let score = 0;
    
    let turncounter = 0;
    let rowoffset = 0;
    
    let animationstate = 0;
    let animationtime = 0;
    
    let showcluster = false;
    let cluster = [];
    let floatingclusters = [];
    
    let images = [];
    let bubbleimage;
    
    let loadcount = 0;
    let loadtotal = 0;
    let preloaded = false;
    
    function loadImages(imagefiles) {
        loadcount = 0;
        loadtotal = imagefiles.length;
        preloaded = false;
        
        let loadedimages = [];
        for (let i=0; i<imagefiles.length; i++) {
            let image = new Image();
            
            image.onload = function () {
                loadcount++;
                if (loadcount == loadtotal) {
                    preloaded = true;
                }
            };
            
            image.src = imagefiles[i];
            
            loadedimages[i] = image;
        }
        
        return loadedimages;
    }

    document.getElementById('music-toggle').addEventListener('click', toggleMusic);
    function toggleMusic() {
        if (backgroundMusic.paused) {
            backgroundMusic.play();
        } else {
            backgroundMusic.pause();
        }
    }

    
    function init() {
        images = loadImages(["assets/img/bubble-sprites.png"]);
        bubbleimage = images[0];
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mousedown", onMouseDown);
        
        for (let i=0; i<level.columns; i++) {
            level.tiles[i] = [];
            for (let j=0; j<level.rows; j++) {
                level.tiles[i][j] = new Tile(i, j, 0, 0);
            }
        }
        
        level.width = level.columns * level.tilewidth + level.tilewidth/2;
        level.height = (level.rows-1) * level.rowheight + level.tileheight;
        
        player.x = level.x + level.width/2 - level.tilewidth/2;
        player.y = level.y + level.height;
        player.angle = 90;
        player.tiletype = 0;
        
        player.nextbubble.x = player.x - 2 * level.tilewidth;
        player.nextbubble.y = player.y;
        
        newGame();
        
        main(0);
    }
    
    function main(tframe) {
        window.requestAnimationFrame(main);
    
        if (!initialized) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            drawFrame();
            
            let loadpercentage = loadcount/loadtotal;
            context.strokeStyle = "#ff8080";
            context.lineWidth=3;
            context.strokeRect(18.5, 0.5 + canvas.height - 51, canvas.width-37, 32);
            context.fillStyle = "#ff8080";
            context.fillRect(18.5, 0.5 + canvas.height - 51, loadpercentage*(canvas.width-37), 32);
            
            let loadtext = "Cargando " + loadcount + "/" + loadtotal + " imagenes";
            context.fillStyle = "#000000";
            context.font = "16px Verdana";
            context.fillText(loadtext, 18, 0.5 + canvas.height - 63);
            
            if (preloaded) {
                setTimeout(function(){initialized = true;}, 1000);
            }
        } else {
            update(tframe);
            render();
        }
    }
    
    function update(tframe) {
        var dt = (tframe - lastframe) / 1000;
        lastframe = tframe;
        
        updateFps(dt);
        
        if (gamestate == gamestates.ready) {
        } else if (gamestate == gamestates.shootbubble) {
            stateShootBubble(dt);
        } else if (gamestate == gamestates.removecluster) {
            stateRemoveCluster(dt);
        }
    }
    
    function setGameState(newgamestate) {
        gamestate = newgamestate;
        
        animationstate = 0;
        animationtime = 0;
    }
    
    function stateShootBubble(dt) {

        player.bubble.x += dt * player.bubble.speed * Math.cos(degToRad(player.bubble.angle));
        player.bubble.y += dt * player.bubble.speed * -1*Math.sin(degToRad(player.bubble.angle));
        
        if (player.bubble.x <= level.x) {
            
            player.bubble.angle = 180 - player.bubble.angle;
            player.bubble.x = level.x;
        } else if (player.bubble.x + level.tilewidth >= level.x + level.width) {

            player.bubble.angle = 180 - player.bubble.angle;
            player.bubble.x = level.x + level.width - level.tilewidth;
        }

        if (player.bubble.y <= level.y) {
            player.bubble.y = level.y;
            snapBubble();
            return;
        }
        
        for (let i=0; i<level.columns; i++) {
            for (let j=0; j<level.rows; j++) {
                let tile = level.tiles[i][j];
                
                if (tile.type < 0) {
                    continue;
                }
                
                let coord = getTileCoordinate(i, j);
                if (circleIntersection(player.bubble.x + level.tilewidth/2,
                                        player.bubble.y + level.tileheight/2,
                                        level.radius,
                                        coord.tilex + level.tilewidth/2,
                                        coord.tiley + level.tileheight/2,
                                        level.radius)) {
                                        
                    snapBubble();
                    return;
                }
            }
        }
    }
    
    function stateRemoveCluster(dt) {
        if (animationstate == 0) {
            resetRemoved();
            
            for (var i=0; i<cluster.length; i++) {
                cluster[i].removed = true;
            }
            
            score += cluster.length * 100;
            
            floatingclusters = findFloatingClusters();
            
            if (floatingclusters.length > 0) {
                for (var i=0; i<floatingclusters.length; i++) {
                    for (var j=0; j<floatingclusters[i].length; j++) {
                        var tile = floatingclusters[i][j];
                        tile.shift = 0;
                        tile.shift = 1;
                        tile.velocity = player.bubble.dropspeed;
                        
                        score += 100;
                    }
                }
            }
            
            animationstate = 1;
        }
        
        if (animationstate == 1) {
            let tilesleft = false;
            for (let i=0; i<cluster.length; i++) {
                let tile = cluster[i];
                
                if (tile.type >= 0) {
                    tilesleft = true;
                    
                    tile.alpha -= dt * 15;
                    if (tile.alpha < 0) {
                        tile.alpha = 0;
                    }

                    if (tile.alpha == 0) {
                        tile.type = -1;
                        tile.alpha = 1;

                        let bubblePopSound = new Audio('assets/sounds/pop.mp3');
                        bubblePopSound.play();
                    }
                }                
            }
            
            for (let i=0; i<floatingclusters.length; i++) {
                for (let j=0; j<floatingclusters[i].length; j++) {
                    let tile = floatingclusters[i][j];
                    
                    if (tile.type >= 0) {
                        tilesleft = true;
                        
                        tile.velocity += dt * 700;
                        tile.shift += dt * tile.velocity;
                            
                        tile.alpha -= dt * 8;
                        if (tile.alpha < 0) {
                            tile.alpha = 0;
                        }

                        if (tile.alpha == 0 || (tile.y * level.rowheight + tile.shift > (level.rows - 1) * level.rowheight + level.tileheight)) {
                            tile.type = -1;
                            tile.shift = 0;
                            tile.alpha = 1;

                            let bubblePopSound = new Audio('assets/sounds/pop.mp3');
                            bubblePopSound.play();
                        }
                    }

                }
            }
            
            if (!tilesleft) {
                nextBubble();
                
                let tilefound = false
                for (let i=0; i<level.columns; i++) {
                    for (let j=0; j<level.rows; j++) {
                        if (level.tiles[i][j].type != -1) {
                            tilefound = true;
                            break;
                        }
                    }
                }
                
                if (tilefound) {
                    setGameState(gamestates.ready);
                } else {
                    setGameState(gamestates.gameover);
                }
            }
        }
    }
    
    function snapBubble() {
        let centerx = player.bubble.x + level.tilewidth/2;
        let centery = player.bubble.y + level.tileheight/2;
        let gridpos = getGridPosition(centerx, centery);

        if (gridpos.x < 0) {
            gridpos.x = 0;
        }
            
        if (gridpos.x >= level.columns) {
            gridpos.x = level.columns - 1;
        }

        if (gridpos.y < 0) {
            gridpos.y = 0;
        }
            
        if (gridpos.y >= level.rows) {
            gridpos.y = level.rows - 1;
        }

        let addtile = false;
        if (level.tiles[gridpos.x][gridpos.y].type != -1) {
            for (let newrow=gridpos.y+1; newrow<level.rows; newrow++) {
                if (level.tiles[gridpos.x][newrow].type == -1) {
                    gridpos.y = newrow;
                    addtile = true;
                    break;
                }
            }
        } else {
            addtile = true;
        }

        if (addtile) {
            player.bubble.visible = false;
        
            level.tiles[gridpos.x][gridpos.y].type = player.bubble.tiletype;
            
            if (checkGameOver()) {
                return;
            }
            
            cluster = findCluster(gridpos.x, gridpos.y, true, true, false);
            
            if (cluster.length >= 3) {
                setGameState(gamestates.removecluster);
                return;
            }
        }
        
        turncounter++;
        if (turncounter >= 5) {
            addBubbles();
            turncounter = 0;
            rowoffset = (rowoffset + 1) % 2;
            
            if (checkGameOver()) {
                return;
            }
        }

        nextBubble();
        setGameState(gamestates.ready);
    }
    
    function checkGameOver() {
        for (let i=0; i<level.columns; i++) {
            if (level.tiles[i][level.rows-1].type != -1) {
                nextBubble();
                setGameState(gamestates.gameover);
                return true;
            }
        }
        
        return false;
    }
    
    function addBubbles() {
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows-1; j++) {
                level.tiles[i][level.rows-1-j].type = level.tiles[i][level.rows-1-j-1].type;
            }
        }
        
        for (let i=0; i<level.columns; i++) {
            level.tiles[i][0].type = getExistingColor();
        }
    }
    
    function findColors() {
        let foundcolors = [];
        let colortable = [];
        for (let i=0; i<bubblecolors; i++) {
            colortable.push(false);
        }
        
        for (let i=0; i<level.columns; i++) {
            for (let j=0; j<level.rows; j++) {
                let tile = level.tiles[i][j];
                if (tile.type >= 0) {
                    if (!colortable[tile.type]) {
                        colortable[tile.type] = true;
                        foundcolors.push(tile.type);
                    }
                }
            }
        }
        
        return foundcolors;
    }
    
    function findCluster(tx, ty, matchtype, reset, skipremoved) {
        if (reset) {
            resetProcessed();
        }
        
        let targettile = level.tiles[tx][ty];
        
        let toprocess = [targettile];
        targettile.processed = true;
        let foundcluster = [];

        while (toprocess.length > 0) {
            let currenttile = toprocess.pop();
            
            if (currenttile.type == -1) {
                continue;
            }
            
            if (skipremoved && currenttile.removed) {
                continue;
            }
            
            if (!matchtype || (currenttile.type == targettile.type)) {
                foundcluster.push(currenttile);
                
                let neighbors = getNeighbors(currenttile);
                
                for (let i=0; i<neighbors.length; i++) {
                    if (!neighbors[i].processed) {
                        toprocess.push(neighbors[i]);
                        neighbors[i].processed = true;
                    }
                }
            }
        }
        
        return foundcluster;
    }
    
    function findFloatingClusters() {
        resetProcessed();
        
        let foundclusters = [];
        
        for (let i=0; i<level.columns; i++) {
            for (let j=0; j<level.rows; j++) {
                let tile = level.tiles[i][j];
                if (!tile.processed) {
                    let foundcluster = findCluster(i, j, false, false, true);
                    
                    if (foundcluster.length <= 0) {
                        continue;
                    }
                    
                    let floating = true;
                    for (let k=0; k<foundcluster.length; k++) {
                        if (foundcluster[k].y == 0) {
                            floating = false;
                            break;
                        }
                    }
                    
                    if (floating) {
                        foundclusters.push(foundcluster);
                    }
                }
            }
        }
        
        return foundclusters;
    }
    
    function resetProcessed() {
        for (let i=0; i<level.columns; i++) {
            for (let j=0; j<level.rows; j++) {
                level.tiles[i][j].processed = false;
            }
        }
    }
    
    function resetRemoved() {
        for (let i=0; i<level.columns; i++) {
            for (let j=0; j<level.rows; j++) {
                level.tiles[i][j].removed = false;
            }
        }
    }
    
    function getNeighbors(tile) {
        let tilerow = (tile.y + rowoffset) % 2; 
        let neighbors = [];
        
        let n = neighborsoffsets[tilerow];
        
        for (let i=0; i<n.length; i++) {
            let nx = tile.x + n[i][0];
            let ny = tile.y + n[i][1];
            
            if (nx >= 0 && nx < level.columns && ny >= 0 && ny < level.rows) {
                neighbors.push(level.tiles[nx][ny]);
            }
        }
        
        return neighbors;
    }
    
    function updateFps(dt) {
        if (fpstime > 0.25) {
            fps = Math.round(framecount / fpstime);
            
            fpstime = 0;
            framecount = 0;
        }
        
        fpstime += dt;
        framecount++;
    }
    
    function drawCenterText(text, x, y, width) {
        let textdim = context.measureText(text);
        context.fillText(text, x + (width-textdim.width)/2, y);
    }
    
    function render() {
        drawFrame();
        
        let yoffset =  level.tileheight/2;
        
        context.fillStyle = "#a7caea";
        context.fillRect(level.x - 4, level.y - 4, level.width + 8, level.height + 4 - yoffset);
        
        renderTiles();
        
        context.fillStyle = "#9af8be";
        context.fillRect(level.x - 4, level.y - 4 + level.height + 4 - yoffset, level.width + 8, 2*level.tileheight + 3);
        
        context.fillStyle = "#592a60";
        context.font = "18px Verdana";
        let scorex = level.x + level.width - 150;
        let scorey = level.y+level.height + level.tileheight - yoffset - 8;
        drawCenterText("Puntos:", scorex, scorey, 150);
        context.font = "24px Verdana";
        drawCenterText(score, scorex, scorey+30, 150);

        if (showcluster) {
            renderCluster(cluster, 255, 128, 128);
            
            for (let i=0; i<floatingclusters.length; i++) {
                let col = Math.floor(100 + 100 * i / floatingclusters.length);
                renderCluster(floatingclusters[i], col, col, col);
            }
        }
        
        renderPlayer();
        
        if (gamestate == gamestates.gameover) {
            context.fillStyle = "rgba(0, 0, 0, 0.8)";
            context.fillRect(level.x - 4, level.y - 4, level.width + 8, level.height + 2 * level.tileheight + 8 - yoffset);
            
            context.fillStyle = "#ffffff";
            context.font = "24px Verdana";
            drawCenterText("¡Perdiste!", level.x, level.y + level.height / 2 + 10, level.width);
            drawCenterText("Click para volver a iniciar", level.x, level.y + level.height / 2 + 40, level.width);
        }
    }
    
    function drawFrame() {
        context.fillStyle = "#c5f3fc";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = "#62f6dd";
        context.fillRect(0, 0, canvas.width, 79);
        
        context.fillStyle = "#8c2be7";
        context.font = "24px Verdana";
        context.fillText("Bubble Shooter Emmy", 10, 37);
        
        context.fillStyle = "#e424f6";
        context.font = "12px Verdana";
        context.fillText("Fps: " + fps, 13, 57);
    }
    
    function renderTiles() {
        for (let j=0; j<level.rows; j++) {
            for (let i=0; i<level.columns; i++) {
                let tile = level.tiles[i][j];
                
                let shift = tile.shift;
                
                let coord = getTileCoordinate(i, j);
                
                if (tile.type >= 0) {
                    context.save();
                    context.globalAlpha = tile.alpha;
                    
                    drawBubble(coord.tilex, coord.tiley + shift, tile.type);
                    
                    context.restore();
                }
            }
        }
    }
    
    function renderCluster(cluster, r, g, b) {
        for (var i=0; i<cluster.length; i++) {
            let coord = getTileCoordinate(cluster[i].x, cluster[i].y);
            
            context.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
            context.fillRect(coord.tilex+level.tilewidth/4, coord.tiley+level.tileheight/4, level.tilewidth/2, level.tileheight/2);
        }
    }
    
    function renderPlayer() {
        var centerx = player.x + level.tilewidth/2;
        var centery = player.y + level.tileheight/2;
        
        context.fillStyle = "#f3e676";
        context.beginPath();
        context.arc(centerx, centery, level.radius+12, 0, 2*Math.PI, false);
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = "#8c8c8c";
        context.stroke();

        context.lineWidth = 2;
        context.strokeStyle = "#0000ff";
        context.beginPath();
        context.moveTo(centerx, centery);
        context.lineTo(centerx + 1.5*level.tilewidth * Math.cos(degToRad(player.angle)), centery - 1.5*level.tileheight * Math.sin(degToRad(player.angle)));
        context.stroke();
        
        drawBubble(player.nextbubble.x, player.nextbubble.y, player.nextbubble.tiletype);
        
        if (player.bubble.visible) {
            drawBubble(player.bubble.x, player.bubble.y, player.bubble.tiletype);
        }
        
    }
    
    function getTileCoordinate(column, row) {
        let tilex = level.x + column * level.tilewidth;
        
        if ((row + rowoffset) % 2) {
            tilex += level.tilewidth/2;
        }
        
        let tiley = level.y + row * level.rowheight;
        return { tilex: tilex, tiley: tiley };
    }
    
    function getGridPosition(x, y) {
        let gridy = Math.floor((y - level.y) / level.rowheight);
        
        let xoffset = 0;
        if ((gridy + rowoffset) % 2) {
            xoffset = level.tilewidth / 2;
        }
        let gridx = Math.floor(((x - xoffset) - level.x) / level.tilewidth);
        
        return { x: gridx, y: gridy };
    }

    function drawBubble(x, y, index) {
        if (index < 0 || index >= bubblecolors)
            return;
        
        context.drawImage(bubbleimage, index * 40, 0, 40, 40, x, y, level.tilewidth, level.tileheight);
    }
    
    function newGame() {
        score = 0;
        
        turncounter = 0;
        rowoffset = 0;
        
        setGameState(gamestates.ready);
        
        createLevel();

        nextBubble();
        nextBubble();
    }
    
    function createLevel() {
        for (let j=0; j<level.rows; j++) {
            let randomtile = randRange(0, bubblecolors-1);
            let count = 0;
            for (let i=0; i<level.columns; i++) {
                if (count >= 2) {
                    let newtile = randRange(0, bubblecolors-1);
                    
                    if (newtile == randomtile) {
                        newtile = (newtile + 1) % bubblecolors;
                    }
                    randomtile = newtile;
                    count = 0;
                }
                count++;
                
                if (j < level.rows/2) {
                    level.tiles[i][j].type = randomtile;
                } else {
                    level.tiles[i][j].type = -1;
                }
            }
        }
    }
    
    function nextBubble() {
        player.tiletype = player.nextbubble.tiletype;
        player.bubble.tiletype = player.nextbubble.tiletype;
        player.bubble.x = player.x;
        player.bubble.y = player.y;
        player.bubble.visible = true;
        
        let nextcolor = getExistingColor();
        
        player.nextbubble.tiletype = nextcolor;
    }
    
    function getExistingColor() {
        existingcolors = findColors();
        
        let bubbletype = 0;
        if (existingcolors.length > 0) {
            bubbletype = existingcolors[randRange(0, existingcolors.length-1)];
        }
        
        return bubbletype;
    }
    
    function randRange(low, high) {
        return Math.floor(low + Math.random()*(high-low+1));
    }
    
    function shootBubble() {
        player.bubble.x = player.x;
        player.bubble.y = player.y;
        player.bubble.angle = player.angle;
        player.bubble.tiletype = player.tiletype;

        setGameState(gamestates.shootbubble);
    }
    
    function circleIntersection(x1, y1, r1, x2, y2, r2) {
        let dx = x1 - x2;
        let dy = y1 - y2;
        let len = Math.sqrt(dx * dx + dy * dy);
        
        if (len < r1 + r2) {
            return true;
        }
        
        return false;
    }
    
    function radToDeg(angle) {
        return angle * (180 / Math.PI);
    }
    
    function degToRad(angle) {
        return angle * (Math.PI / 180);
    }

    function onMouseMove(e) {
        let pos = getMousePos(canvas, e);

        let mouseangle = radToDeg(Math.atan2((player.y+level.tileheight/2) - pos.y, pos.x - (player.x+level.tilewidth/2)));

        if (mouseangle < 0) {
            mouseangle = 180 + (180 + mouseangle);
        }

        let lbound = 8;
        let ubound = 172;
        if (mouseangle > 90 && mouseangle < 270) {
            if (mouseangle > ubound) {
                mouseangle = ubound;
            }
        } else {
            if (mouseangle < lbound || mouseangle >= 270) {
                mouseangle = lbound;
            }
        }

        player.angle = mouseangle;
    }
    
    function onMouseDown(e) {
        var pos = getMousePos(canvas, e);
        
        if (gamestate == gamestates.ready) {
            shootBubble();
        } else if (gamestate == gamestates.gameover) {
            newGame();
        }
    }
    
    function getMousePos(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left)/(rect.right - rect.left)*canvas.width),
            y: Math.round((e.clientY - rect.top)/(rect.bottom - rect.top)*canvas.height)
        };
    }
    
    init();
};