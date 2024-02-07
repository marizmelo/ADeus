import { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import ChatLog, { Message } from "./ChatLog";
import ChatsHistory, { HistoryChat } from './chatsHistory';
import LogoutButton from "./LogoutButton";
import { Button } from "./ui/button";
import { Select } from "./ui/select"
import { Switch } from "./ui/switch"
import { Plus, History } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import PromptForm from "./PromptForm";
import { toast } from "sonner";
import { Console } from "console";

interface Model {
  id: string;
  name: string;
}

export default function Chat({
  supabaseClient,
}: {
  supabaseClient: SupabaseClient;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [entryData, setEntryData] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyChats, setChatsList] = useState<HistoryChat[]>([]);
  const [chatId, setChatId] = useState<Message[]>([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [showChatsHistory, setShowChatsHistory] = useState(false);

  const [useOpenRouter, setUseOpenRouter] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<Model[]>([]); // State to store model names
  const [selectedModel, setSelectedModel] = useState(''); // State to store the selected model ID



  const onSendMsgClick = async () => {
    try {
      let newMessages = [...messages, { role: "user", content: entryData }];
      setMessages(newMessages);
      setEntryData("");

      setWaitingForResponse(true);
      await supabaseClient
        .from("conversations")
        .update({ context: newMessages })
        .eq("id", chatId);

      const { data, error } = await supabaseClient.functions.invoke("chat", {
        body: { messageHistory: newMessages, useOpenRouter, modelId: selectedModel }, // Pass the selected model ID along
      });

      setWaitingForResponse(false);
      if (error) {
        throw error;
      }

      console.log(data)
      setMessages([...newMessages, data?.msg]);
    } catch (error: any) {
      console.error("ERROR", error);
      toast.error(error.message || error.code || error.msg || "Unknown error");
    }
  };

  //fetch OpenRouter Models
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        const data = await response.json();
        setOpenRouterModels(data.data);

        if (data.data.length > 0) {
          setSelectedModel(data.data[0].id);
        }
      } catch (error) {
        console.error("Error fetching models:", error);
      }
    }

    fetchModels();
  }, [])

  useEffect(() => {
    if (messages.length > 1) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const newConversation = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("conversations")
        .insert([
          {
            context: [
              { role: "assistant", content: "Hey, how can I help you?" },
            ],
          },
        ])
        .select("*");
      if (error) {
        console.error("ERROR", error);
      }
      if (!data || data.length == 0) {
        throw new Error("No data returned");
      }
      console.log("data", data);
      setMessages(data[0].context);
      setChatId(data[0].id);
    } catch (error: any) {
      console.error("ERROR", error);
      toast.error(error.message || error.code || error.msg || "Unknown error");
    }
  };

  const fetchLastConversation = async (chatId?: number) => {
    console.log('chatId', chatId)
    try {
      const { data, error } = await supabaseClient
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: false })
        .filter("id", chatId ? "eq" : "not.eq", chatId ? chatId : 0)
        .limit(1);

      if (!data || data.length == 0 || error) {
        newConversation();
      } else {
        console.log("data", data);
        setMessages(data[0].context);
        setChatId(data[0].id);
      }
    } catch (error: any) {
      console.error("ERROR", error);
      toast.error(error.message || error.code || error.msg || "Unknown error");
    }
  };

  useEffect(() => {
    fetchLastConversation();
  }, []);

  return (
    <>
      <div className="h-24 bg-gradient-to-b from-background flex justify-between items-center fixed top-0 w-full"></div>
      
      <div className="fixed flex items-center top-4 left-4 mb-10 space-x-2">
        {/* Toggle switch to choose between OpenAI and OpenRouter */}
        <div className="flex-shrink-0">
          <Switch
            checked={useOpenRouter}
            onChange={(checked) => {
              setUseOpenRouter(checked);
              if (!checked) setSelectedModel(openRouterModels[0].id); // Reset to default model when toggling off
            }}
            size="sm"
            label="Use OpenRouter"
          />
        </div>
        {/* Dropdown for selecting OpenRouter models */}
        {useOpenRouter && (
          <div className="flex-grow min-w-40">
            <Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="ml-4"
            >
              {openRouterModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                  {/* "Hi" */}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="fixed flex space-x-4 top-4 right-4 overflow-x-auto">
        <LogoutButton
          supabaseClient={supabaseClient}
        />
        <Button
          size={'icon'}
          className="rounded-full bg-muted/20 text-muted-foreground hover:bg-muted/40"
          onClick={async () => {
            setMessages([]);
            await newConversation();
          }}
        >
          <Plus size={20} />
        </Button>
        <Button
          size={"icon"}
          className="rounded-full bg-muted/20 text-muted-foreground hover:bg-muted/40"
          onClick={() => {
            setShowChatsHistory(!showChatsHistory)
          }}
        >
          <History size={20} />
        </Button>
        <ThemeToggle />
      </div>

      <div className="p-8 mt-12 mb-32">
      {(
          showChatsHistory ?
            <ChatsHistory 
              supabaseClient={supabaseClient} 
              handleClose={() => { setShowChatsHistory(!showChatsHistory) }}
              fetchLastConversation={(chatId) => { fetchLastConversation(chatId) }}
            /> :
            <ChatLog messages={messages} waitingForResponse={waitingForResponse} />
        )}
      </div>

      <div ref={bottomRef} />
      <PromptForm
        textareaRef={textareaRef}
        entryData={entryData}
        setEntryData={setEntryData}
        waitingForResponse={waitingForResponse}
        onSendMsgClick={onSendMsgClick}
      />
    </>
  );
}