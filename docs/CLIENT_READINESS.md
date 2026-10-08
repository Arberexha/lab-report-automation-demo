# Before offering this to clients

The repository is a learning prototype. Its working upload and n8n connection are useful demonstrations, but they are not evidence that the system is ready for real patient information or medical decision making.

## What exists today

- React upload page and Express `POST /api/cases` endpoint
- PNG/JPEG validation, 10 MB limit, random case IDs, private local file storage
- Authenticated forwarding to a published n8n webhook
- Optional OCR and model-generated educational text returned in the upload response
- Automated tests for the local API and a fictional-image connection check

## Work needed for a client product

1. **Define the product's intended use.** Decide whether the service only captures documents, transcribes them for staff review, or supports clinical decisions. The current model output must not be marketed as a pill recommendation or diagnosis. Get qualified clinical and legal review for the intended market before making such claims.
2. **Protect client data end to end.** Add user authentication, authorization, encrypted storage and backups, access logs, a retention/deletion process, and a documented incident response process. Review the privacy and security terms of hosting, n8n, and model providers. Do not put real reports in a public GitHub repository or in a development n8n workflow.
3. **Separate processing from the web request.** The current API waits up to 90 seconds for n8n and has no case lookup or progress polling. A client product needs durable jobs, retries, failure tracking, and a way to retrieve results later.
4. **Validate and review output.** OCR can swap values and reference ranges. Add structured extraction with source-image verification, uncertainty handling, human review, and tests using approved data before any result drives a downstream action.
5. **Operate it reliably.** Plan monitoring, rate limiting, upload cleanup, storage capacity, secret rotation, environment-specific configuration, deployment, and support procedures. Set cost and usage controls for model calls.
6. **Set boundaries for the UI.** State clearly what the service does, what has been checked, and what requires a qualified professional. The current page says it does not provide medical interpretation, while the optional model workflow can display educational discussion; reconcile this wording before offering it to anyone.

Start with a narrowly scoped, reviewed workflow such as document intake or staff-assisted transcription only after the data-handling and operational requirements are met. The current demo should use fictional test data.
