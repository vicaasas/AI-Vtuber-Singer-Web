/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
import { useEffect, useRef, useCallback, useState } from "react";
import * as PIXI from "pixi.js";
import {
  Live2DModel,
  MotionPreloadStrategy,
  MotionPriority,
} from "pixi-live2d-display-lipsyncpatch";
import { Emitter } from '@pixi/particle-emitter';
import snowflakeImg from '@/assets/snowflake.png'; // ✅ 根據 alias 設定
import heartImg from '@/assets/heart.png';
import micImg from '@/assets/mic.png';
import { gsap } from "gsap";

import {
  ModelInfo,
  useLive2DConfig,
  MotionWeightMap,
  TapMotionMap,
} from "@/context/live2d-config-context";
import { useLive2DModel as useModelContext } from "@/context/live2d-model-context";
import { setModelSize, resetModelPosition } from "./use-live2d-resize";
import { audioTaskQueue } from "@/utils/task-queue";
import { AiStateEnum, useAiState } from "@/context/ai-state-context";
import { toaster } from "@/components/ui/toaster";
import { useForceIgnoreMouse } from "../utils/use-force-ignore-mouse";

interface UseLive2DModelProps {
  isPet: boolean; // Whether the model is in pet mode
  modelInfo: ModelInfo | undefined; // Live2D model configuration information
}

export const useLive2DModel = ({
  isPet,
  modelInfo,
}: UseLive2DModelProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const kScaleRef = useRef<string | number | undefined>(undefined);
  const { setCurrentModel } = useModelContext();
  const { setIsLoading } = useLive2DConfig();
  const loadingRef = useRef(false);
  const { setAiState, aiState } = useAiState();
  const [isModelReady, setIsModelReady] = useState(false);
  const { forceIgnoreMouse } = useForceIgnoreMouse();
  const [showMic, setShowMic] = useState(false);
  const micUpdateRef = useRef<() => void>();
  const micFadeRef = useRef<(delta: number)=>void>();

  // Cleanup function for Live2D model
  const cleanupModel = useCallback(() => {
    if (modelRef.current) {
      modelRef.current.removeAllListeners();
      setCurrentModel(null);
      if (appRef.current) {
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
        modelRef.current = null;
      }
    }
    setIsModelReady(false);
  }, [setCurrentModel]);

  // Cleanup function for PIXI application
  const cleanupApp = useCallback(() => {
    if (appRef.current) {
      if (modelRef.current) {
        cleanupModel();
      }
      appRef.current.stage.removeChildren();
      PIXI.utils.clearTextureCache();
      appRef.current.renderer.clear();
      appRef.current.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
      });
      PIXI.utils.destroyTextureCache();
      appRef.current = null;
    }
  }, [cleanupModel]);

  // Initialize PIXI application with canvas (only once)
  useEffect(() => {
    if (!appRef.current && canvasRef.current) {
      const app = new PIXI.Application({
        view: canvasRef.current, // cavas element to render on
        autoStart: true,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0, // transparent background
        antialias: true, // antialiasing
        clearBeforeRender: true, // clear before render
        preserveDrawingBuffer: false, // don't preserve drawing buffer
        powerPreference: "high-performance", // high performance, use GPU if available
        resolution: window.devicePixelRatio || 1,
        autoDensity: true, // auto adjust resolution to fit the screen
      });

      // Render on every frame
      app.ticker.add(() => {
        if (app.renderer) {
          app.renderer.render(app.stage);
        }
      });

      appRef.current = app;
    }

    return () => {
      cleanupApp();
    };
  }, [cleanupApp]);

  const setupModel = useCallback(
    async (model: Live2DModel) => {
      if (!appRef.current || !modelInfo) return;

      if (modelRef.current) {
        modelRef.current.removeAllListeners();
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
      }

      modelRef.current = model;
      setCurrentModel(model);
      // ✅ 把 model 綁到全域變數（方便從 Console 呼叫）
      (window as any).live2dModel = model;
      appRef.current.stage.addChild(model);

      model.interactive = true;
      model.cursor = "pointer";
      setIsModelReady(true);
    },
    [setCurrentModel],
  );

  const setupModelSizeAndPosition = useCallback(() => {
    if (!modelRef.current) return;
    setModelSize(modelRef.current, kScaleRef.current);

    const { width, height } = isPet
      ? { width: window.innerWidth, height: window.innerHeight }
      : containerRef.current?.getBoundingClientRect() || {
        width: 0,
        height: 0,
      };

    resetModelPosition(modelRef.current, width, height, modelInfo?.initialXshift, modelInfo?.initialYshift);
  }, [modelInfo?.initialXshift, modelInfo?.initialYshift]);

  // Load Live2D model with configuration
  const loadModel = useCallback(async () => {
    if (!modelInfo?.url || !appRef.current) return;

    if (loadingRef.current) return; // Prevent multiple simultaneous loads

    console.log("Loading model:", modelInfo.url);

    try {
      loadingRef.current = true;
      setIsLoading(true);
      setAiState(AiStateEnum.LOADING);

      var url;
      if(modelInfo.url.includes("ngrok-free.app")){
          url = `http://localhost:5000/proxy/live2d?url=${encodeURIComponent(
            modelInfo.url.trim()
          )}`;
      }else{
          url = modelInfo.url;
      }

      // Initialize Live2D model with settings
      const model = await Live2DModel.from(url, {
        autoHitTest: true,
        autoFocus: modelInfo.pointerInteractive ?? false,
        autoUpdate: true,
        ticker: PIXI.Ticker.shared,
        motionPreload: MotionPreloadStrategy.IDLE,
        idleMotionGroup: modelInfo.idleMotionGroupName,
      });

      await setupModel(model);
    } catch (error) {
      console.error("Failed to load Live2D model:", error);
      toaster.create({
        title: `Failed to load Live2D model: ${error}`,
        type: "error",
        duration: 2000,
      });
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setAiState(AiStateEnum.IDLE);
    }
  }, [
    modelInfo?.url,
    modelInfo?.pointerInteractive,
    setIsLoading,
    setupModel,
  ]);

  const setupModelInteractions = useCallback(
    (model: Live2DModel) => {
      if (!model) return;

      // Clear all previous listeners
      model.removeAllListeners("pointerenter");
      model.removeAllListeners("pointerleave");
      model.removeAllListeners("rightdown");
      model.removeAllListeners("pointerdown");
      model.removeAllListeners("pointermove");
      model.removeAllListeners("pointerup");
      model.removeAllListeners("pointerupoutside");

      // If force ignore mouse is enabled, disable interaction
      if (forceIgnoreMouse && isPet) {
        model.interactive = false;
        model.cursor = "default";
        return;
      }

      // Enable interactions
      model.interactive = true;
      model.cursor = "pointer";

      let dragging = false;
      let pointerX = 0;
      let pointerY = 0;
      let isTap = false;
      const dragThreshold = 5;

      if (isPet) {
        model.on("pointerenter", () => {
          (window.api as any)?.updateComponentHover("live2d-model", true);
        });

        model.on("pointerleave", () => {
          if (!dragging) {
            (window.api as any)?.updateComponentHover("live2d-model", false);
          }
        });

        model.on("rightdown", (e: any) => {
          e.data.originalEvent.preventDefault();
          (window.api as any).showContextMenu();
        });
      }

      model.on("pointerdown", (e) => {
        if (e.button === 0) {
          dragging = true;
          isTap = true;
          pointerX = e.global.x - model.x;
          pointerY = e.global.y - model.y;
        }
      });

      model.on("pointermove", (e) => {
        if (dragging) {
          const newX = e.global.x - pointerX;
          const newY = e.global.y - pointerY;
          const dx = newX - model.x;
          const dy = newY - model.y;

          if (Math.hypot(dx, dy) > dragThreshold) {
            isTap = false;
          }

          model.position.x = newX;
          model.position.y = newY;
        }
      });

      model.on("pointerup", (e) => {
        if (dragging) {
          dragging = false;
          if (isTap) {
            handleTapMotion(model, e.global.x, e.global.y);
          }
        }
      });

      model.on("pointerupoutside", () => {
        dragging = false;
      });

      model.on("sing",() => {
        if(modelRef.current==null)return;
        setShowMic(true); // 顯示麥克風
        modelRef.current?.scale.set(0.38);
         const { width, height } = isPet
        ? { width: window.innerWidth, height: window.innerHeight }
        : containerRef.current?.getBoundingClientRect() || {
          width: 0,
          height: 0,
        };
        resetModelPosition(modelRef.current, width, height+700, modelInfo?.initialXshift, modelInfo?.initialYshift);
      });

      model.on("singFinished",() => {
        setShowMic(false); // 顯示麥克風
      });
    },
    [isPet, forceIgnoreMouse],
  );

  const handleTapMotion = useCallback(
    (model: Live2DModel, x: number, y: number) => {
      if (!modelInfo?.tapMotions) return;

      console.log("handleTapMotion", modelInfo?.tapMotions);
      // Convert global coordinates to model's local coordinates
      const localPos = model.toLocal(new PIXI.Point(x, y));
      const hitAreas = model.hitTest(localPos.x, localPos.y);

      const foundMotion = hitAreas.find((area) => {
        const motionGroup = modelInfo?.tapMotions?.[area];
        if (motionGroup) {
          console.log(`Found motion group for area ${area}:`, motionGroup);
          playRandomMotion(model, motionGroup);
          return true;
        }
        return false;
      });

      if (!foundMotion && Object.keys(modelInfo.tapMotions).length > 0) {
        const mergedMotions = getMergedMotionGroup(modelInfo.tapMotions);
        playRandomMotion(model, mergedMotions);
      }
    },
    [modelInfo?.tapMotions],
  );

  // Reset expression when AI state changes to IDLE (like finishing a conversation)
  useEffect(() => {
    if (aiState === AiStateEnum.IDLE) {
      console.log("defaultEmotion: ", modelInfo?.defaultEmotion);
      if (modelInfo?.defaultEmotion) {
        modelRef.current?.internalModel.motionManager.expressionManager?.setExpression(
          modelInfo.defaultEmotion,
        );
      } else {
        modelRef.current?.internalModel.motionManager.expressionManager?.resetExpression();
      }
    }
  }, [modelRef.current, aiState, modelInfo?.defaultEmotion]);

  // Load model when URL changes and cleanup on unmount
  useEffect(() => {
    if (modelInfo?.url) {
      loadModel();
    }
    return () => {
      cleanupModel();
    };
  }, [modelInfo?.url, modelInfo?.pointerInteractive, loadModel, cleanupModel]);

  useEffect(() => {
    kScaleRef.current = modelInfo?.kScale;
  }, [modelInfo?.kScale]);

  useEffect(() => {
    setupModelSizeAndPosition();
  }, [isModelReady, setupModelSizeAndPosition]);

  useEffect(() => {
    if (modelRef.current && isModelReady) {
      setupModelInteractions(modelRef.current);
    }
  }, [isModelReady, setupModelInteractions, forceIgnoreMouse]);

  useEffect(() => {
    if (!appRef.current) return;

    // 建立粒子容器
    const snowContainer = new PIXI.Container();
    const heartContainer = new PIXI.Container();

    appRef.current.stage.addChild(snowContainer);
    appRef.current.stage.addChild(heartContainer);

    // 建立 emitter（發射器）
    const emitter = new Emitter(
      snowContainer,
      {
        lifetime: { min: 1, max: 2 },
        frequency: 0.5,
        emitterLifetime: -1,
        maxParticles: 500,
        pos: { x: 300, y: modelInfo?.initialYshift??0 },
        behaviors: [
          {
            type: "alpha",
            config: {
              alpha: {
                list: [{ value: 0.8, time: 0 }, { value: 0, time: 1 }],
              },
            },
          },
          {
            type: "moveSpeed",
            config: {
              speed: {
                list: [{ value: 100, time: 0 }, { value: 50, time: 1 }],
              },
            },
          },
          {
            type: "scale",
            config: {
              scale: {
                list: [{ value: 0.5, time: 0 }, { value: 0.1, time: 1 }],
              },
            },
          },
          {
            type: 'textureSingle',
            config: {
                texture: PIXI.Texture.from(snowflakeImg)
            }
          }
        ]
      }
    );

    const heartEmitter = new Emitter(
      heartContainer,
      {
        lifetime: { min: 1, max: 2 },
        frequency: 0.2,
        emitterLifetime: -1,
        maxParticles: 500,
        pos: { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight },
        behaviors: [
          {
            type: "alpha",
            config: {
              alpha: {
                list: [{ value: 0.8, time: 0 }, { value: 0, time: 1 }],
              },
            },
          },
          {
            type: "moveSpeed",
            config: {
              speed: {
                list: [{ value: 100, time: 0 }, { value: 50, time: 1 }],
              },
            },
          },
          {
            type: "scale",
            config: {
              scale: {
                list: [{ value: Math.random() * 0.1 + 0.5, time: 0 }, { value: Math.random() * 0.1 + 0.1, time: 1 }],
              },
            },
          },
          {
            type: 'textureSingle',
            config: {
                texture: PIXI.Texture.from(heartImg)
            }
          }
        ]
      }
    );

    var  setRandomPosition =(emitter)=> {
      const x = Math.random() * window.innerWidth;
      const y =  Math.random() * window.innerHeight;
      emitter.updateSpawnPos(x, y);
    }

    // 每幀更新 emitter
    let elapsed = Date.now();
    const update = () => {
      const now = Date.now();
      emitter.update((now - elapsed) * 0.001);
      heartEmitter.update((now - elapsed) * 0.001);
      setRandomPosition(heartEmitter);
          setRandomPosition(emitter);
      elapsed = now;
    };
    appRef.current.ticker.add(update);

    // 清除粒子與 container
    return () => {
      emitter.cleanup();
      appRef.current?.ticker.remove(update);
      appRef.current?.stage.removeChild(snowContainer);
      appRef.current?.stage.removeChild(heartContainer);
      snowContainer.destroy({ children: true });
    };
  }, [modelInfo?.initialXshift, modelInfo?.initialYshift]);

  useEffect(() => {
    if (!appRef.current) return;

    if (showMic) {
      const micTexture = PIXI.Texture.from(micImg);
      const micSprite = new PIXI.Sprite(micTexture);
      micSprite.x = (modelRef.current?.position.x??0);
      micSprite.y = (modelRef.current?.position.y??0)+200;
      micSprite.name = 'mic'; // 給它個名字方便移除
      micSprite.alpha = 0;
      appRef.current.stage.addChild(micSprite);


      let alphaProgress = 0;
      const fadeInTicker = (delta: number) => {
        if (alphaProgress < 1) {
          alphaProgress += delta * 0.05; // 每幀增加透明度（速度可調）
          micSprite.alpha = Math.min(alphaProgress, 1);
        }
      };
      const update = () => {
        if (modelRef.current) {
          
          // 設定相對於 model 的局部座標 (例如 model 頭下方一點)
          const localOffset = new PIXI.Point(-50, 1800); // 模型的 local Y 座標

          // 將局部座標轉為全局座標
          const globalPos = modelRef.current.toGlobal(localOffset);+

          // 設定 micSprite 的位置為該全局座標
          micSprite.position.set(globalPos.x, globalPos.y);
          //配合 model scale 放大縮小
          micSprite.scale.set(2 * modelRef.current.scale.x);
          micSprite.rotation = -Math.PI / 6;
        }
      };
      micUpdateRef.current = update;
      micFadeRef.current = fadeInTicker;
      appRef.current.ticker.add(fadeInTicker);
      appRef.current.ticker.add(update);
    } else {
      const old = appRef.current.stage.getChildByName('mic');
      if (old){
        gsap.to(old, {
          alpha: 0,
          duration: 0.5,
          onComplete: () => {
            appRef.current?.stage.removeChild(old);
          }
        });
      }
      // 清除 ticker 更新
      if (micUpdateRef.current) {
        appRef.current?.ticker.remove(micUpdateRef.current);
        micUpdateRef.current = undefined;
      }
      if (micFadeRef.current) {
        appRef.current?.ticker.remove(micFadeRef.current);
        micFadeRef.current = undefined;
      }
    }
  }, [showMic]);

  return {
    canvasRef,
    appRef,
    modelRef,
    containerRef,
  };
};


const playRandomMotion = (model: Live2DModel, motionGroup: MotionWeightMap) => {
  if (!motionGroup || Object.keys(motionGroup).length === 0) return;

  const totalWeight = Object.values(motionGroup).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  Object.entries(motionGroup).find(([motion, weight]) => {
    random -= weight;
    if (random <= 0) {
      const priority = audioTaskQueue.hasTask()
        ? MotionPriority.NORMAL
        : MotionPriority.FORCE;

      console.log(
        `Playing weighted motion: ${motion} (weight: ${weight}/${totalWeight}, priority: ${priority})`,
      );
      model.motion(motion, undefined, priority);
      return true;
    }
    return false;
  });
};

const getMergedMotionGroup = (
  tapMotions: TapMotionMap,
): MotionWeightMap => {
  const mergedMotions: {
    [key: string]: { total: number; count: number };
  } = {};

  Object.values(tapMotions)
    .flatMap((motionGroup) => Object.entries(motionGroup))
    .reduce((acc, [motion, weight]) => {
      if (!acc[motion]) {
        acc[motion] = { total: 0, count: 0 };
      }
      acc[motion].total += weight;
      acc[motion].count += 1;
      return acc;
    }, mergedMotions);

  return Object.entries(mergedMotions).reduce(
    (acc, [motion, { total, count }]) => ({
      ...acc,
      [motion]: total / count,
    }),
    {} as MotionWeightMap,
  );
};
