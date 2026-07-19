import { Shell } from '../components/layout/Shell'
import { Seo } from '../components/Seo'
import { Breadcrumb } from '../components/layout/Breadcrumb'

export function TermsPage() {
  return (
    <Shell>
      <Seo
        title="Terms and Conditions"
        description="FlowBoard Terms and Conditions: who can use the service, rules, content rights, and liability — plain language."
        path="/terms"
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Terms & Conditions' }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Terms and Conditions
        </h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: July 19, 2026</p>
        <div className="prose-legal mt-6">
          <p>
            Welcome to FlowBoard. By creating an account or using the site, you agree to these Terms.
            If you do not agree, please do not use the service.
          </p>
          <h2>1. Who can use FlowBoard</h2>
          <ul>
            <li>You must be at least 13 years old.</li>
            <li>You must provide accurate account information.</li>
            <li>You are responsible for keeping your password private.</li>
            <li>Organizations may use FlowBoard if an authorized person accepts these Terms.</li>
          </ul>
          <h2>2. What the service is</h2>
          <p>
            FlowBoard is a project and task board product. Features may change as we improve the
            product. We try to keep the service available, but we do not guarantee zero downtime.
          </p>
          <h2>3. Rules for using FlowBoard</h2>
          <p>You agree that you will:</p>
          <ul>
            <li>Use the service for lawful purposes only</li>
            <li>Respect other users’ access and privacy</li>
            <li>Not attempt to break, scan, or overload the service</li>
            <li>Not upload malware or harmful content</li>
            <li>Not pretend to be someone else</li>
          </ul>
          <h2>4. What you can and cannot do</h2>
          <h3>You can</h3>
          <ul>
            <li>Create projects and tasks for personal or team work</li>
            <li>Invite collaborators when that feature is available to you</li>
            <li>Export or delete content you own (where the product allows)</li>
          </ul>
          <h3>You cannot</h3>
          <ul>
            <li>Harass others or post illegal content</li>
            <li>Share accounts in a way that risks security</li>
            <li>Resell the service without permission</li>
            <li>Scrape or copy the product for competing services</li>
          </ul>
          <h2>5. Your content</h2>
          <p>
            You keep ownership of content you create. You give us permission to store and display it
            so the product can work. You are responsible for the content you upload (including
            images and text).
          </p>
          <h2>6. Our right to remove content or suspend accounts</h2>
          <p>
            We may remove content or suspend accounts that break these Terms, harm other users, or
            put the service at risk. We may also remove content required by law.
          </p>
          <h2>7. Limitation of liability</h2>
          <p>
            FlowBoard is provided “as is.” To the fullest extent allowed by law, we are not liable
            for indirect, incidental, or consequential damages, or loss of data/profits from using
            (or not being able to use) the service. Our total liability for any claim is limited to
            the amount you paid us in the 12 months before the claim (or $0 if the service is free).
          </p>
          <h2>8. Changes to these Terms</h2>
          <p>
            We may update these Terms. When we do, we will update the date above. Continued use
            after changes means you accept the new Terms.
          </p>
          <h2>9. Contact</h2>
          <p>
            Questions about these Terms: <strong>brainference@protonmail.com</strong> or{' '}
            <a className="font-semibold text-brand-700" href="/contact">
              Contact us
            </a>
            .
          </p>
        </div>
      </div>
    </Shell>
  )
}
