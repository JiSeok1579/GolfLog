import { useState, type FormEvent, type ReactNode } from "react";
import { Database, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { text, useLanguage } from "../data/i18n";
import { useGolfLog } from "../data/store";

type AuthGateProps = {
  children: ReactNode;
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function errorMessage(code: string, language: "ko" | "en") {
  const messages: Record<string, { ko: string; en: string }> = {
    device_already_registered: {
      ko: "이 기기에는 이미 계정이 등록되어 있습니다.",
      en: "This device already has an account.",
    },
    invalid_profile: {
      ko: "이름과 전화번호를 다시 확인해주세요.",
      en: "Check the name and phone number.",
    },
    invalid_login: {
      ko: "일치하는 계정을 찾을 수 없습니다.",
      en: "No matching account was found.",
    },
    login_failed: {
      ko: "로그인에 실패했습니다. 연결 상태를 확인해주세요.",
      en: "Login failed. Check the connection.",
    },
    phone_already_registered: {
      ko: "이미 등록된 전화번호입니다.",
      en: "This phone number is already registered.",
    },
    register_failed: {
      ko: "등록에 실패했습니다. 연결 상태를 확인해주세요.",
      en: "Registration failed. Check the connection.",
    },
  };
  return messages[code]?.[language] ?? messages.register_failed[language];
}

export function AuthGate({ children }: AuthGateProps) {
  const { authStatus, loginUser, registerUser, serverError } = useGolfLog();
  const { language } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (authStatus === "ready") return <>{children}</>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const input = {
      name: name.trim(),
      phone: normalizePhone(phone),
    };
    const result = mode === "login" ? await loginUser(input) : await registerUser(input);
    setSubmitting(false);

    if (!result.ok) {
      setError(errorMessage(result.error, language));
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          <p className="eyebrow">GolfLog</p>
          <h1>{text(language, "내 골프 기록을 시작합니다", "Start your golf log")}</h1>
          <p>
            {text(
              language,
              "이름과 전화번호로 로그인하거나, 처음 사용하는 기기는 계정을 등록합니다.",
              "Log in with your name and phone number, or register an account for a new device.",
            )}
          </p>
          <div className="auth-badges">
            <Chip tone="accent">
              <ShieldCheck size={14} />
              {text(language, "기기 1계정", "One account")}
            </Chip>
            <Chip>
              <Database size={14} />
              {text(language, "개인 기록", "Private records")}
            </Chip>
          </div>
        </div>

        <Card className="auth-card">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">{mode === "login" ? "Login" : "Register"}</p>
              <h2>{mode === "login" ? text(language, "로그인", "Login") : text(language, "기기 등록", "Register Device")}</h2>
            </div>
          </div>
          <div className="auth-mode-tabs" aria-label={text(language, "계정 작업 선택", "Choose account action")}>
            <button className={mode === "login" ? "active" : ""} onClick={() => {
              setMode("login");
              setError("");
            }} type="button">
              <LogIn size={15} />
              {text(language, "로그인", "Login")}
            </button>
            <button className={mode === "register" ? "active" : ""} onClick={() => {
              setMode("register");
              setError("");
            }} type="button">
              <UserPlus size={15} />
              {text(language, "등록", "Register")}
            </button>
          </div>
          {authStatus === "loading" ? (
            <div className="auth-status">{text(language, "기록 저장소를 확인하는 중입니다.", "Checking record storage.")}</div>
          ) : null}
          {authStatus === "error" ? (
            <div className="form-error">
              {serverError === "server_unavailable"
                ? text(language, "기록 저장소에 연결할 수 없습니다.", "Could not connect to record storage.")
                : text(language, "연결에 문제가 있습니다.", "There is a connection problem.")}
            </div>
          ) : null}
          <form className="form-stack" onSubmit={submit}>
            <label className="field">
              {text(language, "이름", "Name")}
              <input autoComplete="name" onChange={(event) => setName(event.target.value)} value={name} />
            </label>
            <label className="field">
              {text(language, "전화번호", "Phone")}
              <input
                autoComplete="tel"
                inputMode="tel"
                onChange={(event) => setPhone(normalizePhone(event.target.value))}
                placeholder="01012345678"
                value={phone}
              />
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <Button disabled={submitting || authStatus === "loading"} type="submit">
              {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
              {submitting
                ? mode === "login"
                  ? text(language, "로그인 중", "Logging in")
                  : text(language, "등록 중", "Registering")
                : mode === "login"
                  ? text(language, "로그인", "Login")
                  : text(language, "기기 등록", "Register Device")}
            </Button>
          </form>
        </Card>
      </section>
    </main>
  );
}
