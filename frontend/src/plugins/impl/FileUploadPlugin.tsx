/* Copyright 2024 Marimo. All rights reserved. */

import { MousePointerSquareDashedIcon, Upload } from "lucide-react";
import type { JSX } from "react";
import { useDropzone } from "react-dropzone";
import { z } from "zod";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/utils/cn";
import { Logger } from "@/utils/Logger";
import { buttonVariants } from "../../components/ui/button";
import { filesToBase64 } from "../../utils/fileToBase64";
import { renderHTML } from "../core/RenderHTML";
import type { IPlugin, IPluginProps, Setter } from "../types";

type FileUploadType = "button" | "area";

/**
 * Arguments for a file upload area/button
 *
 * @param filetypes - file types to accept (same as HTML input's accept attr)
 * @param multiple - whether to allow the user to upload multiple files
 * @param label - a label for the file upload area
 * @param max_size - the maximum size of the file to upload (in bytes)
 */
interface Data {
  filetypes: string[];
  multiple: boolean;
  kind: FileUploadType;
  label: string | null;
  max_size: number;
}

type T = Array<[string, string]>;

export class FileUploadPlugin implements IPlugin<T, Data> {
  tagName = "marimo-file";

  validator = z.object({
    filetypes: z.array(z.string()),
    multiple: z.boolean(),
    kind: z.enum(["button", "area"]),
    label: z.string().nullable(),
    max_size: z.number(),
  });

  render(props: IPluginProps<T, Data>): JSX.Element {
    return (
      <FileUpload
        label={props.data.label}
        filetypes={props.data.filetypes}
        multiple={props.data.multiple}
        kind={props.data.kind}
        value={props.value}
        setValue={props.setValue}
        max_size={props.data.max_size}
      />
    );
  }
}

/**
 * @param value - array of (filename, filecontents) tuples; filecontents should
 *                be b64 encoded.
 * @param setValue - communicate file upload
 */
interface FileUploadProps extends Data {
  value: T;
  setValue: Setter<T>;
}

function groupFileTypesByMIMEType(extensions: string[]) {
  const filesByMIMEType: Record<string, string[]> = {};

  const appendExt = (mimetype: string, extension: string) => {
    if (Object.hasOwn(filesByMIMEType, mimetype)) {
      filesByMIMEType[mimetype].push(extension);
    } else {
      filesByMIMEType[mimetype] = [extension];
    }
  };

  extensions.forEach((extension) => {
    switch (extension) {
      case ".png":
      case ".jpg":
      case ".jpeg":
      case ".gif":
      case ".avif":
      case ".bmp":
      case ".ico":
      case ".svg":
      case ".tiff":
      case ".webp":
        appendExt("image/*", extension);
        break;
      case ".avi":
      case ".mp4":
      case ".mpeg":
      case ".ogg":
      case ".webm":
        appendExt("video/*", extension);
        break;
      case ".pdf":
        appendExt("application/pdf", extension);
        break;
      case ".csv":
        appendExt("text/csv", extension);
        break;
      default:
        appendExt("text/plain", extension);
    }
  });

  return filesByMIMEType;
}

/* TODO(akshayka): Allow uploading files one-by-one and removing uploaded files
 * when multiple is `True`*/
export const FileUpload = (props: FileUploadProps): JSX.Element => {
  const acceptGroups = groupFileTypesByMIMEType(props.filetypes);
  const { setValue, kind, multiple, value, max_size } = props;
  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: acceptGroups,
      multiple: multiple,
      maxSize: max_size,
      onError: (error) => {
        Logger.error(error);
        toast({
          title: "File upload failed",
          description: error.message,
          variant: "danger",
        });
      },
      onDropRejected: (rejectedFiles) => {
        toast({
          title: "File upload failed",
          description: (
            <div className="flex flex-col gap-1">
              {rejectedFiles.map((file) => (
                <div key={file.file.name}>
                  {file.file.name} (
                  {file.errors.map((e) => e.message).join(", ")})
                </div>
              ))}
            </div>
          ),
          variant: "danger",
        });
      },
      onDrop: (acceptedFiles) => {
        filesToBase64(acceptedFiles)
          .then((value) => {
            setValue(value);
          })
          .catch((error) => {
            Logger.error(error);
            toast({
              title: "File upload failed",
              description: "Failed to convert file to base64.",
              variant: "danger",
            });
          });
      },
    });

  const uploadedFiles = (
    <ul>
      {value.map(([fileName]) => (
        <li key={fileName}>{fileName}</li>
      ))}
    </ul>
  );
  const uploaded = value.length > 0;

  if (kind === "button") {
    // TODO(akshayka): React to a change in `value` due to an update from another
    // instance of this element. Browsers do not allow scripts to set the `value`
    // on a file input element.
    // One way to do this:
    // - hide the input element with a hidden attribute
    // - create a button and some text that reflects what has been uploaded;
    //   link button to the hidden input element
    const label = props.label ?? "Upload";
    return (
      <TooltipProvider>
        <div className="flex flex-row items-center justify-start gap-2">
          <button
            data-testid="marimo-plugin-file-upload-button"
            {...getRootProps({})}
            className={buttonVariants({
              variant: "secondary",
              size: "xs",
            })}
          >
            {renderHTML({ html: label })}
            <Upload size={14} className="ml-2" />
          </button>
          <input {...getInputProps({})} type="file" />
          {uploaded ? (
            <>
              <Tooltip content={uploadedFiles}>
                <span className="text-xs text-muted-foreground">
                  Uploaded{" "}
                  <span className="underline cursor-pointer">
                    {value.length} {value.length === 1 ? "file" : "files"}.
                  </span>
                </span>
              </Tooltip>

              <button
                className={cn(
                  "text-xs cursor-pointer text-destructive hover:underline",
                )}
                onClick={() => setValue([])}
                type="button"
              >
                Click to clear files.
              </button>
            </>
          ) : null}
        </div>
      </TooltipProvider>
    );
  }

  const label =
    props.label ??
    `Drag and drop ${multiple ? "files" : "a file"} here, or click to open file browser`;

  return (
    <section>
      <div className="flex flex-col items-start justify-start flex-grow gap-3">
        <div
          className={cn(
            "hover:text-primary",
            "mt-3 mb-2 w-full flex flex-col items-center justify-center ",
            "px-6 py-6 sm:px-8 sm:py-8 md:py-10 md:px-16",
            "border rounded-sm",
            "text-sm text-muted-foreground",
            "hover:cursor-pointer",
            "active:shadow-xsSolid",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-accent",
            !isFocused && "border-input/60 border-dashed",
            isFocused && "border-solid",
          )}
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center flex-grow gap-3">
            {uploaded ? (
              <span>To re-upload: {renderHTML({ html: label })}</span>
            ) : (
              <span className="mt-0">{renderHTML({ html: label })}</span>
            )}
            <div className="flex flex-row items-center justify-center flex-grow gap-3">
              <Upload
                strokeWidth={1.4}
                className={cn(
                  isDragAccept && "text-primary",
                  isDragReject && "text-destructive",
                )}
              />
              <MousePointerSquareDashedIcon
                strokeWidth={1.4}
                className={cn(
                  isDragAccept && "text-primary",
                  isDragReject && "text-destructive",
                )}
              />
            </div>
          </div>
        </div>

        {uploaded ? (
          <div className="flex flex-row gap-1">
            <div className="text-xs text-muted-foreground">
              <TooltipProvider>
                Uploaded{" "}
                <Tooltip content={uploadedFiles}>
                  <span className="underline cursor-pointer">
                    {value.length} {value.length === 1 ? "file" : "files"}.
                  </span>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-xs text-destructive hover:underline hover:cursor-pointer">
              <button
                className={cn("text-destructive", "hover:underline")}
                onClick={() => setValue([])}
                type="button"
              >
                Click to clear {multiple ? "files" : "file"}.
              </button>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
};
