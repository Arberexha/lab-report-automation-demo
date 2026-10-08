# n8n workflow setup

This guide matches the current learning workflow and site response format. n8n labels may differ slightly by version. Use fictional images only.

## Node order

```text
Webhook -> Edit Fields -> Analyze image -> ai response -> Message a model -> Final response
```

`Edit Fields` and `ai response` are both Edit Fields nodes. `Final response` is a third Edit Fields node; rename it if helpful. Connect each node's main output to the next node's main input. The `Tools` socket under **Message a model** is not used.

## 1. Webhook

- **HTTP Method:** `POST`
- **Path:** `lab-report-upload`
- **Authentication:** `Header Auth`
- **Credential header Name:** `x-webhook-secret`
- **Credential header Value:** the exact value of `N8N_WEBHOOK_SECRET` in your local `.env`
- **Respond:** `When Last Node Finishes`
- **Response Data:** `First Entry JSON`
- **Options -> Field Name for Binary Data:** `report`

The incoming JSON includes `body.caseId`. The multipart image generally appears on the **Binary** tab as `report0`; confirm the actual name in your execution before setting the image node. Use the **Production URL** in `.env`, save and publish the workflow, and submit another image after each published change.

## 2. Edit Fields: keep the case ID and image

Use **Manual Mapping**. Add:

| Field | Type | Value |
| --- | --- | --- |
| `caseId` | String | `{{ $json.body.caseId }}` |
| `status` | String | `received` |

Turn **Include Other Input Fields** on, set **Input Fields to Include** to `All`, and leave **Strip Binary Data** off. This preserves the image for the next node.

## 3. Analyze image: transcribe

Use the OpenAI **Image -> Analyze Image** action with an image-capable model available to your n8n account. Set **Input Type** to `Binary File(s)` and **Input Data Field Name** to `report0` if that is the binary name shown by the preceding node. A starter **Text Input** is:

```text
Transcribe all visible text exactly. If a word is unclear, write [unreadable]. Do not explain, interpret, diagnose, or recommend treatment.
```

The example workflow used `GPT-4O-MINI` and **Simplify Output** on. Model availability, pricing, and output shape may change. Review the execution output instead of assuming every OCR result is correct. Lab tables are especially easy for OCR to mix across columns.

## 4. ai response: extract transcription

Add an Edit Fields node, name it `ai response`, use **Manual Mapping**, and add:

| Field | Type | Value |
| --- | --- | --- |
| `caseId` | String | `{{ $('Edit Fields').first().json.caseId }}` |
| `transcription` | String | `{{ $json[0].content[0].text }}` |
| `ocrStatus` | String | `{{ $json[0].status }}` |

These expressions reflect the output shape observed in this demo's **Analyze image** execution. If your output differs, use the actual JSON path shown by n8n. A `completed` model status only means the model finished; it does not verify transcription accuracy.

## 5. Message a model: educational discussion

Use OpenAI **Text -> Message a Model** with a model available to your account. Add two text messages:

**Message 1, Role `System`:**

```text
This is a fictional learning demo. OCR text may contain errors. Explain up to three general medication categories a clinician might discuss if the values are verified, and what additional information would be needed. If the values or context are unclear, say there is insufficient information. Do not tell the reader to start, stop, or dose any medicine.
```

**Message 2, Role `User`:** `{{ $json.transcription }}`

The original demo used `GPT-4O-MINI`, **Simplify Output** on, and no built-in tools. The model may still invent connections between a value and a medicine category. Do not treat this output as a treatment recommendation.

## 6. Final response: return fields to the website

Add an Edit Fields node after **Message a model**. Use **Manual Mapping**, add these three String fields, and leave **Include Other Input Fields** off:

| Field | Value |
| --- | --- |
| `caseId` | `{{ $('ai response').first().json.caseId }}` |
| `ocrStatus` | `{{ $('ai response').first().json.ocrStatus }}` |
| `demoDiscussion` | `{{ $json.output[0].content[0].text }}` |

`demoDiscussion` is a field name chosen by this site's API. The model text comes from `output[0].content[0].text` in the observed **Message a model** output. If your node's **Output -> JSON** differs, change only the expression to match its text location. The final output should be a single JSON item containing all three top-level fields, with a nonempty `demoDiscussion`.

Save and **Publish**. Submit a new fictional image from the site and inspect the new n8n execution. The site waits for the webhook response for up to 90 seconds.

## Troubleshooting

| Symptom | What to inspect |
| --- | --- |
| Site stays on `Processing` | The site does not poll. Submit a new image after publishing. In the latest execution, check that the **Final response** node ran and returned `caseId`, `ocrStatus: completed`, and nonempty `demoDiscussion`. Confirm Webhook **Respond** and **Response Data** settings above. |
| Site says `Review needed` | Inspect `ocrStatus` and the final response text. A non-completed model result or empty discussion needs review. |
| Site shows an upload error | Confirm the production workflow is published, `.env` uses `/webhook/` rather than `/webhook-test/`, Header Auth matches, and the workflow completes within 90 seconds. |
| Analyze image cannot find the file | Check the Webhook and first Edit Fields **Binary** tabs for the actual file field name; keep **Strip Binary Data** off. |
| Final node has no input | Check that its **left main input** is connected to the **right main output** of Message a model. The node creation menu opens if a connection is dropped on empty canvas. |
| Discussion names pills from uncertain data | Revise the System prompt and examine the OCR output. The model response is unverified and must not be used as a prescription. |

See the official [n8n Webhook documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) and [n8n OpenAI node documentation](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-langchain.openai/) for changes to these controls.
