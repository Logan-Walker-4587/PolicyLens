const getModelId = (languageModel, mediaType) => {
  if (languageModel === "1.5-pro-exp-0801") {
    return "gemini-1.5-pro-exp-0801";
  } else if (languageModel === "1.5-pro") {
    return "gemini-1.5-pro";
  } else if (languageModel === "1.5-flash") {
    return "gemini-1.5-flash";
  } else if (mediaType === "image") {
    return "gemini-1.5-flash";
  } else {
    return "gemini-1.0-pro";
  }
};


  const getSystemPrompt = async (actionType, mediaType, languageCode, taskInputLength) => {
    const languageNames = {
      en: "English",
      // other language mappings
    };
  
    const systemPrompt = `You are a privacy policy analysis expert. Your task is to read and analyze the following privacy policy. Identify and summarize the key points, focusing on the following aspects:
  
  1. **Data Collection**: What types of data are being collected from the users? (e.g., personal information, browsing data, location data)
  2. **Purpose of Data Usage**: How is the collected data used? (e.g., for advertising, improving services, sharing with third parties)
  3. **Data Sharing**: Does the policy mention sharing data with third parties? If yes, who are these third parties, and for what purpose?
  4. **Data Selling**: Does the company sell the collected data to other entities? If so, what types of data are sold and to whom?
  5. **User Rights**: What rights do users have regarding their data? (e.g., the right to access, correct, delete their data)
  6. **Data Storage and Security**: How is the data stored, and what security measures are in place to protect it?
  7. **Cookies and Tracking**: Does the policy mention the use of cookies or other tracking technologies? If so, for what purposes?
  8. **Third-Party Services**: Does the policy mention the use of third-party services or plugins? How do these services interact with user data?
  9. **Changes to the Policy**: Does the policy mention how users will be informed of changes to the privacy policy?
  10. **Data Retention**: How long is the data retained by the company?
  
  Summarize each point in a clear and concise manner. Provide a bullet-point list of the most critical information found in the privacy policy.
  And finally provide a number from 1-10 on how safe it is to proceed.
  Also list open source alternatives.`;
  
    return systemPrompt;
  };
  

const getCharacterLimit = (modelId, actionType) => {
  // Limit on the number of characters handled at one time
  // so as not to exceed the maximum number of tokens sent and received by the API.
  // In Gemini, the calculation is performed in the following way
  // Summarize: The number of characters is the same as the maximum number of input tokens in the model,
  //            but is reduced because an Internal Server Error occurs
  // Translate: Number of characters equal to the maximum number of output tokens in the model
  // noTextCustom: The same as Summarize
  // textCustom: The same as Summarize
  const characterLimits = {
    "gemini-1.5-pro-exp-0801": {
      summarize: 1572864,
      translate: 8192,
      noTextCustom: 1572864,
      textCustom: 1572864
    },
    "gemini-1.5-pro": {
      summarize: 1572864,
      translate: 8192,
      noTextCustom: 1572864,
      textCustom: 1572864
    },
    "gemini-1.5-flash": {
      summarize: 786432,
      translate: 8192,
      noTextCustom: 786432,
      textCustom: 786432
    },
    "gemini-1.0-pro": {
      summarize: 25600,
      translate: 2048,
      noTextCustom: 25600,
      textCustom: 25600
    }
  };

  return characterLimits[modelId][actionType];
};

const chunkText = (text, chunkSize) => {
  const chunks = [];
  // ।: U+0964 Devanagari Danda
  const sentenceBreaks = ["\n\n", "।", "。", "．", ".", "\n", " "];
  let remainingText = text.replace(/\r\n?/g, "\n");

  while (remainingText.length > chunkSize) {
    const currentChunk = remainingText.substring(0, chunkSize);
    let index = -1;

    // Look for sentence breaks at 80% of the chunk size or later
    for (const sentenceBreak of sentenceBreaks) {
      index = currentChunk.indexOf(sentenceBreak, Math.floor(chunkSize * 0.8));

      if (index !== -1) {
        index += sentenceBreak.length;
        break;
      }
    }

    if (index === -1) {
      index = chunkSize;
    }

    chunks.push(remainingText.substring(0, index));
    remainingText = remainingText.substring(index);
  }

  chunks.push(remainingText);
  return chunks;
};

const tryJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    if (request.message === "chunk") {
      // Split the task input
      const { actionType, mediaType, taskInput, languageModel } = request;
      const modelId = getModelId(languageModel, mediaType);
      const chunkSize = getCharacterLimit(modelId, actionType);
      const taskInputChunks = chunkText(taskInput, chunkSize);
      sendResponse(taskInputChunks);
    } else if (request.message === "generate") {
      // Generate content
      await chrome.storage.session.set({ taskCache: "", responseCache: {} });
      const { actionType, mediaType, taskInput, languageModel, languageCode } = request;
      const { apiKey } = await chrome.storage.local.get({ apiKey: "" });
      const modelId = getModelId(languageModel, mediaType);

      const systemPrompt = await getSystemPrompt(
        actionType,
        mediaType,
        languageCode,
        taskInput.length
      );

      let contents = [];

      if (mediaType === "image") {
        const [mediaInfo, mediaData] = taskInput.split(",");
        const mediaType = mediaInfo.split(":")[1].split(";")[0];

        contents.push({
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: mediaType,
                data: mediaData
              }
            }
          ]
        });
      } else {
        contents.push({
          role: "user",
          parts: [{ text: systemPrompt + "\nText:\n" + taskInput }]
        });
      }

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: contents,
            safetySettings: [{
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }]
          })
        });

        const responseData = {
          ok: response.ok,
          status: response.status,
          body: tryJsonParse(await response.text())
        };

        if (response.ok) {
          const taskData = JSON.stringify({ actionType, mediaType, taskInput, languageModel, languageCode });
          await chrome.storage.session.set({ taskCache: taskData, responseCache: responseData });
        }

        sendResponse(responseData);
      } catch (error) {
        sendResponse({
          ok: false,
          status: 1000,
          body: { error: { message: error.stack } }
        });
      }
    }
  })();

  return true;
});
