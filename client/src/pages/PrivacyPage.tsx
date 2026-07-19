import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'

export function PrivacyPage() {
  return (
    <Shell>
      <Seo
        title="Privacy Policy"
        description="Plain-language Privacy Policy for FlowBoard: what we collect, how we use it, and your choices."
        path="/privacy"
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Privacy Policy' }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: July 19, 2026</p>
        <div className="prose-legal mt-6">
          <p>
            This Privacy Policy explains how FlowBoard (“we”, “us”) handles information when you use
            our website and app. We wrote it to be clear — not legal maze.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account info</strong> — email, name, and a hashed password (we never store
              your password in plain text).
            </li>
            <li>
              <strong>Project data you create</strong> — boards, tasks, comments, checklists, tags,
              and optional images you upload.
            </li>
            <li>
              <strong>Contact messages</strong> — if you write to us through the contact form.
            </li>
            <li>
              <strong>Basic technical logs</strong> — may include IP address and timestamps for
              security and reliability.
            </li>
          </ul>
          <h2>How we use information</h2>
          <ul>
            <li>To run your account and show your boards</li>
            <li>To keep the service secure and fix problems</li>
            <li>To respond when you contact us</li>
          </ul>
          <p>We do not sell your personal information.</p>
          <h2>Cookies</h2>
          <p>
            We use a secure session cookie so you stay signed in. You can sign out at any time, which
            clears that cookie.
          </p>
          <h2>Sharing</h2>
          <p>
            We share data only when needed to run the service (for example, hosting), to comply with
            law, or to protect safety. Project invites you send can make content visible to people
            you invite.
          </p>
          <h2>How long we keep data</h2>
          <p>
            We keep account and project data while your account is active. You can delete tasks and
            projects you own. Contact us if you need help closing an account.
          </p>
          <h2>Security</h2>
          <p>
            We use industry practices like password hashing and access controls. No method is 100%
            secure, so please use a strong unique password.
          </p>
          <h2>Children</h2>
          <p>FlowBoard is not directed at children under 13. Do not register if you are under 13.</p>
          <h2>Your choices</h2>
          <ul>
            <li>Update your name and content inside the app</li>
            <li>Delete tasks/projects you own</li>
            <li>Contact us about privacy questions</li>
          </ul>
          <h2>Changes</h2>
          <p>
            We may update this policy. We will change the “Last updated” date when we do. Continued
            use means you accept the updated policy.
          </p>
          <h2>Contact</h2>
          <p>
            Questions? Email <strong>brainference@protonmail.com</strong> or use the{' '}
            <a className="font-semibold text-brand-700" href="/contact">
              Contact
            </a>{' '}
            page.
          </p>
        </div>
      </div>
    </Shell>
  )
}
