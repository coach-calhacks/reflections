import { useCallback, useState, useRef, useEffect } from "react"
import { useConversation } from "@elevenlabs/react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2Icon, PhoneIcon, PhoneOffIcon } from "lucide-react"

import { cn } from "@/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Orb } from "@/components/ui/orb"
import { ShimmeringText } from "@/components/ui/shimmering-text"
import type { VoiceMessage, ConversationData } from "@shared/types"

const DEFAULT_AGENT = {
  agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID || "",
}

type AgentState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | null

interface VoiceChatProps {
  userInfo?: {
    name: string
    email: string
  }
  onEnded?: () => void
}

export default function VoiceChat({ userInfo, onEnded }: VoiceChatProps) {
  const displayName = userInfo?.name ? `Welcome, ${userInfo.name}` : "Agent"
  const displayDescription = userInfo?.email || "Tap to start voice chat"
  const [agentState, setAgentState] = useState<AgentState>("disconnected")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const conversationMessages = useRef<VoiceMessage[]>([])
  const sessionStartTime = useRef<string | null>(null)
  const shouldUpload = useRef(false)

  const uploadConversation = useCallback(async () => {
    if (conversationMessages.current.length === 0) {
      console.log("No messages to upload")
      return
    }

    if (!sessionStartTime.current) {
      console.log("No session start time")
      return
    }

    setIsProcessing(true)
    const conversationData: ConversationData = {
      messages: conversationMessages.current,
      sessionStartAt: sessionStartTime.current,
      sessionEndAt: new Date().toISOString(),
    }

    try {
      console.log("Uploading conversation with", conversationData.messages.length, "messages")
      const result = await window.context.uploadConversation(conversationData)
      if (result.success) {
        console.log("Conversation uploaded successfully")
      } else {
        console.error("Failed to upload conversation:", result.error)
      }
    } catch (error) {
      console.error("Error uploading conversation:", error)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  // Handle background upload after call ends
  useEffect(() => {
    if (shouldUpload.current && agentState === "disconnected") {
      shouldUpload.current = false
      uploadConversation()
    }
  }, [agentState, uploadConversation])

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected")
      sessionStartTime.current = new Date().toISOString()
      conversationMessages.current = []
    },
    onDisconnect: () => {
      console.log("Disconnected")
      // Mark for upload (will happen in useEffect)
      shouldUpload.current = true
      // Invoke onEnded when the call ends naturally or via button
      if (onEnded) onEnded()
    },
    onMessage: (message) => {
      console.log("Message:", message)
      // Store the message
      const voiceMessage: VoiceMessage = {
        role: message.source === 'user' ? 'user' : 'assistant',
        message: message.message || '',
        timestamp: Date.now(),
      }
      conversationMessages.current.push(voiceMessage)
    },
    onError: (error) => {
      console.error("Error:", error)
      setAgentState("disconnected")
      // Also treat error-triggered disconnect as end
      if (onEnded) onEnded()
    },
  })

  const startConversation = useCallback(async () => {
    try {
      setErrorMessage(null)
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Hardcoded dynamic variables for ElevenLabs agent
      const dynamicVariables = {
        "first-name": userInfo?.name || "Caden",
        "user-background": "Caden is an AI Software Engineer at Notion and an undergraduate at UC Berkeley studying CS. He comes from Great Neck, a highly competitive academic environment. After high school, he explored startups with a close friend, gaining massive opportunities but also experiencing a cofounder breakup when his friend wanted to drop out. This led him to reflect on his values - realizing the journey from exploring freedom had become another rat race. He chose Berkeley to keep his opportunities open, though sometimes regrets the competitive environment. After a summer interning at Notion (working long hours with little social life) and a disappointing experience at Cluely, he's now at Berkeley feeling lost and in autopilot. He's taking all STEM classes (Math 53H, CS61A, CS61B, AI for startups) which he slightly regrets. Currently trying to find his way through reading books, working on fun projects like this Coach app, and learning to talk to new people, though that's not going the best.",
        "user-backgroundsummary": "Berkeley CS student and Notion engineer feeling lost in autopilot mode after a cofounder breakup and intense summer. Trying to rediscover meaning through books, fun projects, and connecting with people, while navigating imposter syndrome and questioning his path.",
      }
      
      await conversation.startSession({
        agentId: DEFAULT_AGENT.agentId,
        connectionType: "webrtc",
        dynamicVariables: dynamicVariables,
        onStatusChange: (status) => setAgentState(status.status),
      })
    } catch (error) {
      console.error("Error starting conversation:", error)
      setAgentState("disconnected")
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Please enable microphone permissions in your browser.")
      }
    }
  }, [conversation, userInfo, uploadConversation])

  const handleCall = useCallback(() => {
    if (agentState === "disconnected" || agentState === null) {
      setAgentState("connecting")
      startConversation()
    } else if (agentState === "connected") {
      // End call immediately - upload will happen in background
      shouldUpload.current = true
      conversation.endSession()
      setAgentState("disconnected")
      // Ending via button should also trigger onEnded
      if (onEnded) onEnded()
    }
  }, [agentState, conversation, startConversation, onEnded])

  const isCallActive = agentState === "connected"
  const isTransitioning =
    agentState === "connecting" || agentState === "disconnecting"

  const getInputVolume = useCallback(() => {
    const rawValue = conversation.getInputVolume?.() ?? 0
    return Math.min(1.0, Math.pow(rawValue, 0.5) * 2.5)
  }, [conversation])

  const getOutputVolume = useCallback(() => {
    const rawValue = conversation.getOutputVolume?.() ?? 0
    return Math.min(1.0, Math.pow(rawValue, 0.5) * 2.5)
  }, [conversation])

  return (
    <Card className="flex h-[400px] w-full flex-col items-center justify-center overflow-hidden p-6 relative">
      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4"
          >
            <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium">Processing conversation...</p>
              <p className="text-xs text-muted-foreground">Analyzing and saving your chat</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center gap-6">
        <div className="relative size-32">
          <div className="bg-muted relative h-full w-full rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
            <div className="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]">
              <Orb
                className="h-full w-full"
                volumeMode="manual"
                getInputVolume={getInputVolume}
                getOutputVolume={getOutputVolume}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-semibold">{displayName}</h2>
          <AnimatePresence mode="wait">
            {errorMessage ? (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="text-destructive text-center text-sm"
              >
                {errorMessage}
              </motion.p>
            ) : agentState === "disconnected" || agentState === null ? (
              <motion.p
                key="disconnected"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="text-muted-foreground text-sm"
              >
                {displayDescription}
              </motion.p>
            ) : (
              <motion.div
                key="status"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2"
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-all duration-300",
                    agentState === "connected" && "bg-green-500",
                    isTransitioning && "bg-primary/60 animate-pulse"
                  )}
                />
                <span className="text-sm capitalize">
                  {isTransitioning ? (
                    <ShimmeringText text={agentState} />
                  ) : (
                    <span className="text-green-600">Connected</span>
                  )}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button
          onClick={handleCall}
          disabled={isTransitioning}
          size="icon"
          variant={isCallActive ? "secondary" : "default"}
          className="h-12 w-12 rounded-full"
        >
          <AnimatePresence mode="wait">
            {isTransitioning ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{
                  rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                }}
              >
                <Loader2Icon className="h-5 w-5" />
              </motion.div>
            ) : isCallActive ? (
              <motion.div
                key="end"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <PhoneOffIcon className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div
                key="start"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <PhoneIcon className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </Card>
  )
}
