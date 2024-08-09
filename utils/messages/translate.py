import google.generativeai
import json
import os


def main():
    languageList = {
        "de": "German",
        "es": "Spanish",
        "fr": "French",
        "it": "Italian",
        "pt_BR": "Brazilian Portuguese",
        "vi": "Vietnamese",
        "ru": "Russian",
        "ar": "Arabic",
        "hi": "Hindi",
        "bn": "Bengali",
        "zh_CN": "Simplified Chinese",
        "zh_TW": "Traditional Chinese",
        "ko": "Korean"
    }

    google.generativeai.configure(
        api_key="AIzaSyCIU0tmpYITQ2u6KyPN1pHadiGPKY6ryhI"
    )

    with open("../../extension/_locales/en/messages.json", 'r') as f:
        messages = f.read()

    for languageCode, languageName in languageList.items():
        print(languageCode, languageName)

        system_instruction = f"Translate the following JSON content to {languageName}" \
            " in a formal tone. The word \"Gemini\" must be left in English."

        model = google.generativeai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.0
            }
        )

        try:
            response = model.generate_content(messages)

            json_obj = json.loads(
                response.candidates[0].content.parts[0].text
            )

            json_text = json.dumps(
                json_obj, indent=4, ensure_ascii=False
            )

            os.makedirs(f"output/{languageCode}", exist_ok=True)

            with open(f"output/{languageCode}/messages.json", 'w') as f:
                f.write(json_text)
        except Exception as e:
            print("Failed to generate content:", e)


if __name__ == '__main__':
    main()
