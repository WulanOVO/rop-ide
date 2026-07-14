import { useState, useRef, useEffect } from 'react';
import style from './styles/NewFilePanel.module.scss';
import { useTranslation } from './i18n';

const SERVER_GADGETS = ['fx-991CNX_VerC.json', 'fx-991CNX_VerF.json'];

export default function NewFilePanel({ show, isDirty, onClose, onConfirm }) {
  const t = useTranslation();
  const [fileName, setFileName] = useState('');
  const [leftAddress, setLeftAddress] = useState('E9E0');
  const [rightAddress, setRightAddress] = useState('D710');
  const [gadgetOption, setGadgetOption] = useState('none'); // 'none', 'copy', 'local', 'server'
  const [localGadgetFile, setLocalGadgetFile] = useState(null);
  const [ropFileToCopy, setRopFileToCopy] = useState(null);
  const [serverGadget, setServerGadget] = useState(SERVER_GADGETS[0]);

  const localGadgetFileInputRef = useRef(null);
  const ropFileInputRef = useRef(null);

  const handleConfirm = async () => {
    if (isDirty && !confirm(t('msg.confirmDiscardNew'))) {
      return;
    }

    if (!fileName.trim()) {
      alert(t('newFile.nameEmpty'));
      return;
    }

    let gadgets = [];
    try {
      if (gadgetOption === 'copy' && ropFileToCopy) {
        const fileContent = await ropFileToCopy.text();
        const fileData = JSON.parse(fileContent);
        gadgets = fileData.gadgets || [];
      } else if (gadgetOption === 'local' && localGadgetFile) {
        const fileContent = await localGadgetFile.text();
        gadgets = JSON.parse(fileContent);
      } else if (gadgetOption === 'server') {
        const response = await fetch(`./${serverGadget}`);
        gadgets = await response.json();
      }
    } catch (error) {
      alert(t('newFile.loadGadgetsError'));
      console.error('Error loading gadgets:', error);
      return;
    }

    onConfirm({
      fileName: fileName.trim() + '.rop',
      leftAddress,
      rightAddress,
      gadgets,
    });
  };

  const handleLocalGadgetFileChange = (e) => {
    setLocalGadgetFile(e.target.files[0] || null);
  };

  const handleRopFileChange = (e) => {
    setRopFileToCopy(e.target.files[0] || null);
  };

  useEffect(() => {
    if (!show) {
      setFileName('');
      setLeftAddress('E9E0');
      setRightAddress('D710');
      setGadgetOption('none');
      setLocalGadgetFile(null);
      setRopFileToCopy(null);
    }
  }, [show]);

  if (!show) {
    return null;
  }

  return (
    <div className={style.overlay}>
      <div className={style.panel}>
        <h2>{t('newFile.title')}</h2>

        <div className={style.formGroup}>
          <label>{t('newFile.fileName')}</label>
          <input
            type="text"
            value={fileName}
            placeholder={t('newFile.fileNamePlaceholder')}
            onChange={(e) => setFileName(e.target.value)}
          />
        </div>

        <div className={style.formGroup}>
          <label>{t('newFile.leftAddr')}</label>
          <input
            type="text"
            value={leftAddress}
            onChange={(e) => setLeftAddress(e.target.value)}
          />
        </div>

        <div className={style.formGroup}>
          <label>{t('newFile.rightAddr')}</label>
          <input
            type="text"
            value={rightAddress}
            onChange={(e) => setRightAddress(e.target.value)}
          />
        </div>

        <div className={style.formGroup}>
          <label>{t('newFile.gadgetSource')}</label>
          <div className={style.radioGroup}>
            <label>
              <input
                type="radio"
                name="gadgetOption"
                value="none"
                checked={gadgetOption === 'none'}
                onChange={() => setGadgetOption('none')}
              />
              {t('newFile.none')}
            </label>
            <label>
              <input
                type="radio"
                name="gadgetOption"
                value="copy"
                checked={gadgetOption === 'copy'}
                onChange={() => setGadgetOption('copy')}
              />
              {t('newFile.copyFromExisting')}
            </label>
            {gadgetOption === 'copy' && (
              <input
                type="file"
                ref={ropFileInputRef}
                accept=".rop"
                onChange={handleRopFileChange}
              />
            )}
            <label>
              <input
                type="radio"
                name="gadgetOption"
                value="local"
                checked={gadgetOption === 'local'}
                onChange={() => setGadgetOption('local')}
              />
              {t('newFile.importLocal')}
            </label>
            {gadgetOption === 'local' && (
              <input
                type="file"
                ref={localGadgetFileInputRef}
                accept=".json"
                onChange={handleLocalGadgetFileChange}
              />
            )}
            <label>
              <input
                type="radio"
                name="gadgetOption"
                value="server"
                checked={gadgetOption === 'server'}
                onChange={() => setGadgetOption('server')}
              />
              {t('newFile.selectPreset')}
            </label>
            {gadgetOption === 'server' && (
              <select
                value={serverGadget}
                onChange={(e) => setServerGadget(e.target.value)}
                className={style.serverGadgetSelect}
              >
                {SERVER_GADGETS.map((gadget) => (
                  <option key={gadget} value={gadget}>
                    {gadget}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className={style.buttonGroup}>
          <button onClick={onClose}>{t('newFile.cancel')}</button>
          <button onClick={handleConfirm}>{t('newFile.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
